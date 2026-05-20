import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { recommendThemes, type RecommenderInput, TAG_CATALOG, ENGINE_VERSION } from '@/lib/themeRecommender';

const NUMERIC_FIELDS = [
  'fatigueScore', 'fatigueAcceptable', 'fatigueDesired',
  'happinessScore', 'happinessAcceptable', 'happinessDesired',
  'energyScore', 'energyAcceptable', 'energyDesired',
  'goalProgress',
] as const;

function sanitize(raw: any): RecommenderInput {
  const out: RecommenderInput = {};
  if (typeof raw?.userId === 'string') out.userId = raw.userId.slice(0, 80);
  if (typeof raw?.firstName === 'string') out.firstName = raw.firstName.slice(0, 80);
  if (typeof raw?.chosenGoal === 'string') out.chosenGoal = raw.chosenGoal.slice(0, 500);
  if (raw?.language === 'en' || raw?.language === 'nl') out.language = raw.language;
  for (const k of NUMERIC_FIELDS) {
    const v = raw?.[k];
    if (typeof v === 'number' && Number.isFinite(v)) (out as any)[k] = v;
  }
  for (const k of ['energyIn', 'energyCosts', 'energyLeaks'] as const) {
    const v = raw?.[k];
    if (Array.isArray(v)) out[k] = v.filter((x: unknown): x is string => typeof x === 'string').slice(0, 50);
  }
  return out;
}

export async function POST(req: NextRequest) {
  try {
    await requireAuth();
    const body = await req.json().catch(() => ({}));
    const input = sanitize(body);
    const result = recommendThemes(input);
    return NextResponse.json(result);
  } catch (err: any) {
    if (err?.message === 'UNAUTHORIZED') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET() {
  try {
    await requireAuth();
    return NextResponse.json({ engineVersion: ENGINE_VERSION, tagCatalog: TAG_CATALOG });
  } catch (err: any) {
    if (err?.message === 'UNAUTHORIZED') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
