import path from 'path';
import fs from 'fs';
import { getDb, insertRagChunk, clearRagDocumentsBySource } from '../src/lib/db';
import { embedText } from '../src/lib/rag';

const CONTENT_DIR = path.join(process.cwd(), 'data', 'app-content');
const CHUNK_SIZE = 500;
const CHUNK_OVERLAP = 100;

function chunkText(text: string, size = CHUNK_SIZE, overlap = CHUNK_OVERLAP): string[] {
  const words = text.split(/\s+/);
  const chunks: string[] = [];
  let i = 0;
  while (i < words.length) {
    const chunk = words.slice(i, i + size).join(' ');
    chunks.push(chunk);
    i += size - overlap;
  }
  return chunks;
}

async function ingest() {
  if (!fs.existsSync(CONTENT_DIR)) {
    console.log('No content directory found at', CONTENT_DIR);
    console.log('Create data/app-content/ and add .txt files to ingest');
    return;
  }

  const files = fs.readdirSync(CONTENT_DIR).filter(f => f.endsWith('.txt') || f.endsWith('.md'));
  if (files.length === 0) {
    console.log('No .txt or .md files found in', CONTENT_DIR);
    return;
  }

  for (const file of files) {
    const source = file.replace(/\.[^.]+$/, '');
    const filePath = path.join(CONTENT_DIR, file);
    const text = fs.readFileSync(filePath, 'utf-8');
    const chunks = chunkText(text);

    console.log(`Ingesting ${file} (${chunks.length} chunks)...`);
    clearRagDocumentsBySource(source);

    for (let i = 0; i < chunks.length; i++) {
      const embedding = await embedText(chunks[i]);
      insertRagChunk(source, file, i, chunks[i], embedding);
      process.stdout.write(`  chunk ${i + 1}/${chunks.length}\r`);
    }
    console.log(`  Done: ${chunks.length} chunks stored`);
  }

  console.log('\nIngestion complete.');
}

ingest().catch(console.error);
