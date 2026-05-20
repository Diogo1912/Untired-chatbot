import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getUserPreferences, upsertUserPreferences } from '@/lib/db';
import { SELECTABLE_MODELS, resolveModel, PRIMARY_MODEL } from '@/lib/llm';
import { readSettingsTyped } from '@/lib/appSettings';

export async function GET() {
  try {
    const user = await requireAuth();
    const prefs = getUserPreferences(user.id);
    const cfg = readSettingsTyped();
    const defaultLanguage = (cfg['coach.default_language'] as string) || 'nl';
    const defaultModel = (cfg['coach.default_model'] as string) || PRIMARY_MODEL;
    const defaultShowBreathing = cfg['coach.show_breathing_default'] !== false;
    const defaultShowAppFeatures = cfg['coach.show_app_features_default'] !== false;
    return NextResponse.json({
      customPrompt: prefs?.custom_prompt ?? '',
      showBreathing: prefs ? prefs.show_breathing !== 0 : defaultShowBreathing,
      showAppFeatures: prefs ? prefs.show_app_features !== 0 : defaultShowAppFeatures,
      language: prefs?.language ?? defaultLanguage,
      primaryModel: resolveModel(prefs?.primary_model ?? defaultModel),
      availableModels: SELECTABLE_MODELS,
      defaultModel,
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
    // Only persist known model ids; anything else becomes null (falls back to default).
    const primaryModel = body.primaryModel === undefined
      ? undefined
      : (SELECTABLE_MODELS.some(m => m.id === body.primaryModel) ? body.primaryModel : null);
    const prefs = upsertUserPreferences(user.id, {
      customPrompt: body.customPrompt,
      showBreathing: body.showBreathing,
      showAppFeatures: body.showAppFeatures,
      language: body.language,
      primaryModel,
    });
    return NextResponse.json({ ok: true, prefs });
  } catch (err: any) {
    if (err.message === 'UNAUTHORIZED') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
