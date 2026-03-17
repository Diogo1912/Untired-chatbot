import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getChatById, getChatNote, upsertChatNote } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth();
    const { searchParams } = new URL(req.url);
    const chatId = searchParams.get('chatId');
    if (!chatId) return NextResponse.json({ error: 'chatId required' }, { status: 400 });

    const chat = getChatById(chatId);
    if (!chat || chat.user_id !== user.id) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const note = getChatNote(chatId);
    return NextResponse.json({ note: note?.note ?? '' });
  } catch (err: any) {
    if (err.message === 'UNAUTHORIZED') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const user = await requireAuth();
    const { chatId, note } = await req.json();
    if (!chatId) return NextResponse.json({ error: 'chatId required' }, { status: 400 });

    const chat = getChatById(chatId);
    if (!chat || chat.user_id !== user.id) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    upsertChatNote(chatId, user.id, note ?? '');
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    if (err.message === 'UNAUTHORIZED') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
