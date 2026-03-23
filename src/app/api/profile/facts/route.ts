import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getProfileFacts, deleteProfileFact, rebuildDynamicProfile, migrateProfileToFacts, getProfile } from '@/lib/db';

export async function GET() {
  try {
    const user = await requireAuth();
    // One-time migration of legacy dynamic_profile text → facts rows
    migrateProfileToFacts(user.id);
    const facts = getProfileFacts(user.id);
    const profile = getProfile(user.id);
    return NextResponse.json({ facts, profile: profile ?? null });
  } catch (err: any) {
    if (err.message === 'UNAUTHORIZED') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const user = await requireAuth();
    const { id } = await req.json();
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
    deleteProfileFact(id, user.id);
    rebuildDynamicProfile(user.id);
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    if (err.message === 'UNAUTHORIZED') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
