/**
 * RAG ingestion pipeline
 *
 * Supported formats: .txt  .md  .docx
 *
 * Usage:
 *   npm run ingest                                    # reads data/app-content/
 *   npm run ingest -- /path/to/content/folder        # custom directory
 *   CONTENT_DIR=/path/to/folder npm run ingest       # via env var
 */

import path from 'path';
import fs from 'fs';
import mammoth from 'mammoth';
import { insertRagChunk, clearRagDocumentsBySource } from '../src/lib/db';
import { embedText } from '../src/lib/rag';

// Load .env.local so the script works outside Next.js
const envFile = path.join(process.cwd(), '.env.local');
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, 'utf-8').split('\n')) {
    const m = line.match(/^([^#=\s][^=]*)=(.*)$/);
    if (m) {
      const key = m[1].trim();
      const val = m[2].trim().replace(/^["']|["']$/g, '');
      if (!process.env[key]) process.env[key] = val;
    }
  }
}

// ─── Config ───────────────────────────────────────────────────────────────────

const CONTENT_DIR =
  process.argv[2] ??
  process.env.CONTENT_DIR ??
  path.join(process.cwd(), 'data', 'app-content');

const CHUNK_SIZE = 500;     // words per chunk
const CHUNK_OVERLAP = 80;   // word overlap between chunks

// ─── Helpers ─────────────────────────────────────────────────────────────────

function chunkText(text: string, size = CHUNK_SIZE, overlap = CHUNK_OVERLAP): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const chunks: string[] = [];
  let i = 0;
  while (i < words.length) {
    const chunk = words.slice(i, i + size).join(' ');
    if (chunk.trim()) chunks.push(chunk);
    i += size - overlap;
  }
  return chunks;
}

async function extractText(filePath: string): Promise<string> {
  const ext = path.extname(filePath).toLowerCase();

  if (ext === '.txt' || ext === '.md') {
    return fs.readFileSync(filePath, 'utf-8');
  }

  if (ext === '.docx') {
    const result = await mammoth.extractRawText({ path: filePath });
    if (result.messages.length) {
      result.messages.forEach(m => {
        if (m.type === 'warning') console.warn(`  ⚠ ${path.basename(filePath)}: ${m.message}`);
      });
    }
    return result.value;
  }

  throw new Error(`Unsupported file type: ${ext}`);
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function ingest() {
  const absDir = path.resolve(CONTENT_DIR);

  if (!fs.existsSync(absDir)) {
    console.error(`Content directory not found: ${absDir}`);
    console.error('Usage: npm run ingest -- /path/to/content');
    process.exit(1);
  }

  const SUPPORTED = ['.txt', '.md', '.docx'];
  const files = fs.readdirSync(absDir).filter(f => {
    if (f.startsWith('~$')) return false; // skip Word temp files
    return SUPPORTED.includes(path.extname(f).toLowerCase());
  });

  if (files.length === 0) {
    console.log(`No supported files found in ${absDir}`);
    console.log(`Supported: ${SUPPORTED.join(', ')}`);
    return;
  }

  console.log(`\nIngesting ${files.length} files from:\n  ${absDir}\n`);

  let totalChunks = 0;
  let skipped = 0;

  for (const file of files) {
    const filePath = path.join(absDir, file);
    const title = path.basename(file, path.extname(file));
    const source = slugify(title);

    try {
      process.stdout.write(`📄 ${title}\n`);
      const text = await extractText(filePath);

      if (text.trim().length < 50) {
        console.log(`   Skipped (too short)\n`);
        skipped++;
        continue;
      }

      const chunks = chunkText(text);
      clearRagDocumentsBySource(source);

      for (let i = 0; i < chunks.length; i++) {
        const embedding = await embedText(chunks[i]);
        insertRagChunk(title, source, i, chunks[i], embedding);
        process.stdout.write(`   chunk ${i + 1}/${chunks.length}\r`);
      }

      totalChunks += chunks.length;
      console.log(`   ✓ ${chunks.length} chunks stored           `);
    } catch (err: any) {
      console.error(`   ✗ Error: ${err.message}`);
      skipped++;
    }
  }

  console.log(`\n────────────────────────────────`);
  console.log(`Files processed : ${files.length - skipped}`);
  console.log(`Chunks stored   : ${totalChunks}`);
  if (skipped > 0) console.log(`Skipped         : ${skipped}`);
  console.log(`────────────────────────────────\n`);
}

ingest().catch(err => {
  console.error('Ingestion failed:', err);
  process.exit(1);
});
