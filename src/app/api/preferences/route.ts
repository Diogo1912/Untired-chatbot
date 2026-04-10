import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getUserPreferences, upsertUserPreferences } from '@/lib/db';

export async function GET() {
  try {
    const user = await requireAuth();
    const prefs = getUserPreferences(user.id);
    return NextResponse.json({
      customPrompt: prefs?.custom_prompt ?? '',
      showBreathing: prefs?.show_breathing !== 0,
      showAppFeatures: prefs?.show_app_features !== 0,
      language: prefs?.language ?? 'nl',
    });
  } catch (err: any) {
    if (err.message === 'UNAUTHORIZED') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const user = await requireAuth();
    const body = await req.json();
    const prefs = upsertUserPreferences(user.id, {
      customPrompt: body.customPrompt,
      showBreathing: body.showBreathing,
      showAppFeatures: body.showAppFeatures,
      language: body.language,
    });
    return NextResponse.json({ ok: true, prefs });
  } catch (err: any) {
    if (err.message === 'UNAUTHORIZED') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
