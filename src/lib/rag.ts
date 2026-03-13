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

export async function embedText(text: string): Promise<number[]> {
  const client = getOpenRouter();
  const response = await client.embeddings.create({
    model: EMBEDDING_MODEL,
    input: text,
  });
  return response.data[0].embedding;
}

export async function retrieveContext(query: string, topK = 3): Promise<{ chunks: string[]; count: number }> {
  try {
    const chunks = getAllRagChunks();
    if (chunks.length === 0) return { chunks: [], count: 0 };

    const queryEmbedding = await embedText(query);
    const scored = chunks.map(chunk => ({
      text: chunk.chunk_text,
      title: chunk.title,
      score: cosineSimilarity(queryEmbedding, chunk.embedding),
    }));

    scored.sort((a, b) => b.score - a.score);
    const top = scored.slice(0, topK).filter(s => s.score > 0.3);

    return {
      chunks: top.map(s => `[${s.title}]\n${s.text}`),
      count: top.length,
    };
  } catch {
    return { chunks: [], count: 0 };
  }
}
