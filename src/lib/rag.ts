import { getOpenRouter, EMBEDDING_MODEL } from './llm';
import { getAllRagChunks } from './db';

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

// ─── Embedding cache ──────────────────────────────────────────────────────────

let cachedChunks: { chunk_text: string; title: string; theme_name: string | null; embedding: number[] }[] | null = null;
let cacheTimestamp = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export function clearRagCache() {
  cachedChunks = null;
  cacheTimestamp = 0;
}

function getCachedChunks() {
  if (cachedChunks && Date.now() - cacheTimestamp < CACHE_TTL) {
    return cachedChunks;
  }
  cachedChunks = getAllRagChunks();
  cacheTimestamp = Date.now();
  return cachedChunks;
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function embedText(text: string): Promise<number[]> {
  const client = getOpenRouter();
  const response = await client.embeddings.create({
    model: EMBEDDING_MODEL,
    input: text,
  });
  return response.data[0].embedding;
}

export async function retrieveContext(query: string, topK = 3): Promise<{ chunks: string[]; count: number; topSimilarity: number | null }> {
  try {
    const chunks = getCachedChunks();
    if (chunks.length === 0) return { chunks: [], count: 0, topSimilarity: null };

    const queryEmbedding = await embedText(query);
    const scored = chunks.map(chunk => ({
      text: chunk.chunk_text,
      title: chunk.title,
      themeName: chunk.theme_name,
      score: cosineSimilarity(queryEmbedding, chunk.embedding),
    }));

    scored.sort((a, b) => b.score - a.score);
    const topSimilarity = scored[0]?.score ?? null;
    const top = scored.slice(0, topK).filter(s => s.score > 0.3);

    return {
      chunks: top.map(s => {
        const label = s.themeName ? `[From: ${s.themeName} theme]` : `[${s.title}]`;
        return `${label}\n${s.text}`;
      }),
      count: top.length,
      topSimilarity,
    };
  } catch {
    return { chunks: [], count: 0, topSimilarity: null };
  }
}
