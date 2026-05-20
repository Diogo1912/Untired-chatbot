import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { SETTING_DEFS, readAllSettings, writeSettings } from '@/lib/appSettings';

export async function GET() {
  try {
    await requireAdmin();
    return NextResponse.json({ defs: SETTING_DEFS, values: readAllSettings() });
  } catch (err: any) {
    if (err?.message === 'UNAUTHORIZED') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (err?.message === 'FORBIDDEN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireAdmin();
    const body = await req.json().catch(() => ({}));
    if (!body || typeof body !== 'object') return NextResponse.json({ error: 'Bad request' }, { status: 400 });
    writeSettings(body as Record<string, string>);
    return NextResponse.json({ defs: SETTING_DEFS, values: readAllSettings() });
  } catch (err: any) {
    if (err?.message === 'UNAUTHORIZED') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (err?.message === 'FORBIDDEN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
