/**
 * RAG ingestion pipeline
 *
 * Supported formats: .txt  .md  .docx
 *
 * Usage:
 *   npm run ingest                                    # reads rag-content/ (only if empty)
 *   npm run ingest -- --reset                         # wipes rag_documents first, then re-ingests
 *   npm run ingest -- /path/to/content/folder         # custom directory
 *   npm run ingest -- --reset /path/to/folder         # both
 *   CONTENT_DIR=/path/to/folder npm run ingest        # via env var
 *
 * Every ingested chunk is tagged with a `theme_name` drawn from the canonical
 * content registry (src/lib/untireContent.ts). Files that do not match a
 * canonical theme, exercise, or Tips are SKIPPED so they can never surface in
 * retrieval with a made-up label.
 */

import path from 'path';
import fs from 'fs';
import mammoth from 'mammoth';
import { insertRagChunk, clearRagDocumentsBySource, getDb } from '../src/lib/db';
import { embedText } from '../src/lib/rag';
import { UNTIRE_THEMES, UNTIRE_EXERCISES, UNTIRE_TIPS } from '../src/lib/untireContent';

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

// ─── Args ────────────────────────────────────────────────────────────────────

const rawArgs = process.argv.slice(2);
const RESET = rawArgs.includes('--reset');
const CONTENT_DIR =
  rawArgs.find(a => !a.startsWith('--')) ??
  process.env.CONTENT_DIR ??
  path.join(process.cwd(), 'rag-content');

const CHUNK_SIZE = 500;     // words per chunk
const CHUNK_OVERLAP = 80;   // word overlap between chunks

// ─── Filename → canonical content mapping ────────────────────────────────────
//
// Keys are lowercase filename prefixes. Order matters: the first matching
// prefix wins, so more-specific prefixes must come before shorter ones.
// `kind` decides where the content rolls up:
//   - 'theme'    → one of the 17 canonical themes
//   - 'exercise' → one of the exercise categories (relaxation / fitness / strength)
//   - 'tips'     → Tips section
//   - 'skip'     → intentionally not ingested (off-list content, WIP, wrong language)

type Mapping =
  | { kind: 'theme'; themeId: string }
  | { kind: 'exercise'; exerciseId: string }
  | { kind: 'tips' }
  | { kind: 'skip'; reason: string };

const FILENAME_MAPPING: Array<{ prefix: string; mapping: Mapping }> = [
  // Themes (all 17, alphabetised by filename prefix)
  { prefix: 'adjust',                 mapping: { kind: 'theme', themeId: 'adjust_and_process' } },
  { prefix: 'anxiety',                mapping: { kind: 'theme', themeId: 'anxiety' } },
  { prefix: 'boundaries',             mapping: { kind: 'theme', themeId: 'boundaries' } },
  { prefix: 'building up',            mapping: { kind: 'theme', themeId: 'building_up_reserve' } },
  { prefix: 'depression',             mapping: { kind: 'theme', themeId: 'depression' } },
  { prefix: 'fatigue',                mapping: { kind: 'theme', themeId: 'fatigue' } },
  { prefix: 'managing problems',      mapping: { kind: 'theme', themeId: 'dealing_with_problems' } },
  { prefix: 'managing your energy',   mapping: { kind: 'theme', themeId: 'managing_energy' } },
  { prefix: 'nutrition',              mapping: { kind: 'theme', themeId: 'nutrition' } },
  { prefix: 'piekeren',               mapping: { kind: 'theme', themeId: 'worrying' } },
  { prefix: 'pijn',                   mapping: { kind: 'theme', themeId: 'pain' } },
  { prefix: 'selfcare',               mapping: { kind: 'theme', themeId: 'selfcare' } },
  { prefix: 'slaap',                  mapping: { kind: 'theme', themeId: 'sleep' } },
  { prefix: 'stress',                 mapping: { kind: 'theme', themeId: 'stress' } },
  { prefix: 'veerkracht',             mapping: { kind: 'theme', themeId: 'resilience' } },
  { prefix: 'work',                   mapping: { kind: 'theme', themeId: 'work' } },

  // Exercises
  { prefix: 'fitness',                mapping: { kind: 'exercise', exerciseId: 'fitness' } },
  { prefix: 'or nl',                  mapping: { kind: 'exercise', exerciseId: 'relaxation' } }, // Ontspanning & Rust
  // Note: 'building up strength' will match 'building up' above first. That
  // file covers the "Reserves opbouwen" theme, not the Kracht exercise.

  // Tips
  { prefix: 'tips',                   mapping: { kind: 'tips' } },

  // Explicit skips — still listed so the log tells us *why* they were dropped
  // rather than silently falling through.
  { prefix: 'cognitive',              mapping: { kind: 'skip', reason: 'Not in canonical 17-theme list' } },
  { prefix: 'social',                 mapping: { kind: 'skip', reason: 'WIP / not in canonical list' } },
  { prefix: 'verloren',               mapping: { kind: 'skip', reason: 'Not in canonical 17-theme list' } },
  { prefix: 'instructions',           mapping: { kind: 'skip', reason: 'Internal instructions, not user-facing content' } },
  { prefix: 'intro es',               mapping: { kind: 'skip', reason: 'Spanish intro — coach supports NL + EN only' } },
];

function mapFilename(title: string): Mapping | null {
  const lower = title.toLowerCase();
  for (const { prefix, mapping } of FILENAME_MAPPING) {
    if (lower.startsWith(prefix)) return mapping;
  }
  return null;
}

/**
 * Resolve a mapping to the exact `theme_name` string we want stored on every
 * chunk from that file. This is what the system prompt injects as the
 * "mention this exact theme" label, so it MUST match one of the names the
 * coach is allowed to say.
 */
function displayNameForMapping(m: Mapping): string | undefined {
  if (m.kind === 'theme') {
    const theme = UNTIRE_THEMES.find(t => t.id === m.themeId);
    return theme?.nameNl;
  }
  if (m.kind === 'exercise') {
    const ex = UNTIRE_EXERCISES.find(e => e.id === m.exerciseId);
    return ex ? `Oefeningen: ${ex.nameNl}` : undefined;
  }
  if (m.kind === 'tips') return UNTIRE_TIPS.nameNl;
  return undefined;
}

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
    console.warn(`Content directory not found: ${absDir} — skipping ingest.`);
    return;
  }

  const db = getDb();
  const existing = (db.prepare('SELECT COUNT(*) as c FROM rag_documents').get() as any).c;

  if (RESET && existing > 0) {
    db.prepare('DELETE FROM rag_documents').run();
    console.log(`🗑  Cleared ${existing} existing chunks (--reset)\n`);
  } else if (existing > 0) {
    console.log(`RAG already has ${existing} chunks — pass --reset to re-ingest.`);
    return;
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
  let unmapped = 0;

  for (const file of files) {
    const filePath = path.join(absDir, file);
    const title = path.basename(file, path.extname(file));
    const source = slugify(title);
    const mapping = mapFilename(title);

    if (!mapping) {
      console.log(`⚠  ${title}`);
      console.log(`   Skipped — no canonical mapping. Add an entry to FILENAME_MAPPING if this is real app content.\n`);
      unmapped++;
      continue;
    }

    if (mapping.kind === 'skip') {
      console.log(`⏭  ${title}`);
      console.log(`   Skipped — ${mapping.reason}\n`);
      skipped++;
      continue;
    }

    const themeName = displayNameForMapping(mapping);

    try {
      process.stdout.write(`📄 ${title}${themeName ? ` [${themeName}]` : ''}\n`);
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
        insertRagChunk(title, source, i, chunks[i], embedding, themeName);
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
  console.log(`Files ingested  : ${files.length - skipped - unmapped}`);
  console.log(`Chunks stored   : ${totalChunks}`);
  if (skipped > 0)  console.log(`Skipped (mapped): ${skipped}`);
  if (unmapped > 0) console.log(`Skipped (no map): ${unmapped}   ← add FILENAME_MAPPING entries if needed`);
  console.log(`────────────────────────────────\n`);
}

ingest().catch(err => {
  console.error('Ingestion failed:', err);
  process.exit(1);
});
