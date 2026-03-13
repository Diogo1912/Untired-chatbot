import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getProfile, upsertProfile } from '@/lib/db';

export async function GET() {
  try {
    const user = await requireAuth();
    const profile = getProfile(user.id);
    return NextResponse.json({ profile: profile ?? null });
  } catch (err: any) {
    if (err.message === 'UNAUTHORIZED') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth();
    const data = await req.json();
    const allowed = ['name', 'age', 'current_fatigue_level', 'last_fatigue_asked_date'];
    const filtered = Object.fromEntries(Object.entries(data).filter(([k]) => allowed.includes(k)));
    const profile = upsertProfile(user.id, filtered);
    return NextResponse.json({ profile });
  } catch (err: any) {
    if (err.message === 'UNAUTHORIZED') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
