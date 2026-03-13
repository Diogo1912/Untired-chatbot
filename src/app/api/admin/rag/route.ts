import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { insertRagChunk, getAllRagChunks, clearRagDocumentsBySource } from '@/lib/db';
import { embedText } from '@/lib/rag';

// GET — list all RAG documents (grouped by source)
export async function GET() {
  try {
    await requireAdmin();
    const chunks = getAllRagChunks();
    // Group by source
    const grouped: Record<string, { source: string; chunkCount: number; title: string; createdAt: string }> = {};
    for (const chunk of chunks) {
      if (!grouped[chunk.source]) {
        grouped[chunk.source] = {
          source: chunk.source,
          title: chunk.title,
          chunkCount: 0,
          createdAt: chunk.created_at,
        };
      }
      grouped[chunk.source].chunkCount++;
    }
    return NextResponse.json({ documents: Object.values(grouped) });
  } catch (err: any) {
    if (err.message === 'UNAUTHORIZED' || err.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST — ingest a new document (plain text body)
export async function POST(req: NextRequest) {
  try {
    await requireAdmin();
    const { title, source, content } = await req.json();

    if (!title || !source || !content) {
      return NextResponse.json({ error: 'title, source, and content are required' }, { status: 400 });
    }

    // Chunk the content
    const CHUNK_SIZE = 500;
    const OVERLAP = 100;
    const words = content.split(/\s+/);
    const chunks: string[] = [];
    let i = 0;
    while (i < words.length) {
      chunks.push(words.slice(i, i + CHUNK_SIZE).join(' '));
      i += CHUNK_SIZE - OVERLAP;
    }

    if (chunks.length === 0) {
      return NextResponse.json({ error: 'Content too short' }, { status: 400 });
    }

    // Clear existing chunks for this source
    clearRagDocumentsBySource(source);

    // Embed and store each chunk
    for (let idx = 0; idx < chunks.length; idx++) {
      const embedding = await embedText(chunks[idx]);
      insertRagChunk(title, source, idx, chunks[idx], embedding);
    }

    return NextResponse.json({ success: true, chunksCreated: chunks.length });
  } catch (err: any) {
    if (err.message === 'UNAUTHORIZED' || err.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    console.error('RAG ingest error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE — remove a document by source
export async function DELETE(req: NextRequest) {
  try {
    await requireAdmin();
    const { source } = await req.json();
    if (!source) return NextResponse.json({ error: 'source required' }, { status: 400 });
    clearRagDocumentsBySource(source);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    if (err.message === 'UNAUTHORIZED' || err.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
