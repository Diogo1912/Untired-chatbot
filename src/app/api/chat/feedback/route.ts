import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getChatById, getMessageById, upsertMessageFeedback } from '@/lib/db';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth();
    const body = await req.json();
    const { messageId, rating } = body;
    let reason = body.reason;

    if (typeof messageId !== 'string' || !UUID_RE.test(messageId)) {
      return NextResponse.json({ error: 'Invalid messageId' }, { status: 400 });
    }
    if (rating !== 1 && rating !== -1) {
      return NextResponse.json({ error: 'rating must be 1 or -1' }, { status: 400 });
    }
    if (reason !== undefined && reason !== null) {
      if (typeof reason !== 'string') return NextResponse.json({ error: 'reason must be a string' }, { status: 400 });
      reason = reason.trim().slice(0, 1000);
      if (!reason) reason = null;
    } else {
      reason = null;
    }

    // Verify the message belongs to a chat owned by this user, and is an assistant message.
    const msg = getMessageById(messageId);
    if (!msg || msg.role !== 'assistant') return NextResponse.json({ error: 'Message not found' }, { status: 404 });
    const chat = getChatById(msg.chat_id);
    if (!chat || chat.user_id !== user.id) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const record = upsertMessageFeedback(messageId, user.id, msg.chat_id, rating, reason);
    return NextResponse.json({ ok: true, feedback: { rating: record.rating, reason: record.reason } });
  } catch (err: any) {
    if (err.message === 'UNAUTHORIZED') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    console.error('Feedback error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
