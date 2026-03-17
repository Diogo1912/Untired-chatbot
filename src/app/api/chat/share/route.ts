import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getChatById, upsertShareToken } from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth();
    const { chatId } = await req.json();
    if (!chatId) return NextResponse.json({ error: 'chatId required' }, { status: 400 });

    const chat = getChatById(chatId);
    if (!chat || chat.user_id !== user.id) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const token = upsertShareToken(chatId, user.id);
    const origin = req.headers.get('origin') ?? req.headers.get('host') ?? '';
    const shareUrl = `${origin}/share/${token}`;

    return NextResponse.json({ shareUrl, token });
  } catch (err: any) {
    if (err.message === 'UNAUTHORIZED') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
