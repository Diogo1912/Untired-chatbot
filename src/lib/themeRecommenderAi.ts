// AI variant of the theme recommender.
//
// Uses a light model (Claude Haiku by default) to pick 1–2 themes from the
// canonical Untire inventory AND generate a short, friendly, personalised
// "prescription"-style message based on the user's input. The model is hard-
// constrained: it can ONLY return theme IDs from the inventory, and the message
// is bounded in length + tone via the system prompt + post-processing.
//
// Compared to the rule-based engine (themeRecommender.ts), this is the
// experimental side-by-side variant — the rule engine remains the default
// for compliance.

import { getOpenRouter, EVAL_MODEL, calculateCost } from './llm';
import { UNTIRE_THEMES } from './untireContent';
import { readSettingsTyped } from './appSettings';
import type { RecommenderInput, RecommenderResult, Recommendation, Language } from './themeRecommender';

const VALID_THEME_IDS = new Set(UNTIRE_THEMES.map(t => t.id));

function themeInventory(language: Language): string {
  return UNTIRE_THEMES
    .map(t => `  - ${t.id}: ${language === 'nl' ? t.nameNl : t.nameEn} — ${t.blurb}`)
    .join('\n');
}

function buildSystemPrompt(language: Language, topN: number): string {
  const inventory = themeInventory(language);
  const lang = language === 'nl' ? 'Dutch (Nederlands)' : 'English';
  return `You are a calm, warm coach for the Untire Now app, supporting people with cancer-related fatigue.

Your job: read the user's structured energy & mood input and recommend up to ${topN} themes from the inventory below to start with. You also write ONE short personal message (like a friendly prescription note) that the user will read alongside the recommendation.

AUTHORITATIVE THEME INVENTORY (use ONLY these theme IDs — do not invent any others):
${inventory}

WRITE THE MESSAGE IN ${lang}. Keep it ≤ 3 sentences. Warm, second-person, no medical advice, no diagnosis, no promises. Reference one or two concrete things the user shared (their goal, an energy leak, a score gap) so it feels personal — not generic.

OUTPUT FORMAT — return STRICT JSON only, no prose around it:
{
  "themeIds": ["theme_id_1", "theme_id_2"],
  "message": "Your short personal message here.",
  "rationaleByTheme": {
    "theme_id_1": "one short sentence explaining why this theme fits this user",
    "theme_id_2": "one short sentence explaining why this theme fits this user"
  }
}

Constraints:
- 1 to ${topN} theme IDs (most relevant first).
- Every theme ID MUST be from the inventory above. If you are tempted to invent one, pick the closest match from the list instead.
- The message must be supportive but not therapeutic — no clinical claims, no medication, no commands.`;
}

function summariseInput(input: RecommenderInput, language: Language): string {
  const L = language === 'nl';
  const lines: string[] = [];
  if (input.firstName) lines.push(`${L ? 'Voornaam' : 'First name'}: ${input.firstName}`);
  const triple = (label: string, score?: number, acc?: number, des?: number) => {
    if (score == null && acc == null && des == null) return;
    lines.push(`${label}: ${score ?? '?'} (${L ? 'acceptabel' : 'acceptable'}: ${acc ?? '?'}, ${L ? 'gewenst' : 'desired'}: ${des ?? '?'})`);
  };
  triple(L ? 'Vermoeidheid' : 'Fatigue', input.fatigueScore, input.fatigueAcceptable, input.fatigueDesired);
  triple(L ? 'Geluk' : 'Happiness', input.happinessScore, input.happinessAcceptable, input.happinessDesired);
  triple(L ? 'Energie' : 'Energy', input.energyScore, input.energyAcceptable, input.energyDesired);
  if (input.chosenGoal) lines.push(`${L ? 'Doel' : 'Chosen goal'}: ${input.chosenGoal}`);
  if (input.goalProgress != null) lines.push(`${L ? 'Voortgang' : 'Goal progress'}: ${input.goalProgress}`);
  if (input.energyIn?.length) lines.push(`${L ? 'Geeft energie' : 'Energy IN'}: ${input.energyIn.join(', ')}`);
  if (input.energyCosts?.length) lines.push(`${L ? 'Kost energie' : 'Energy costs'}: ${input.energyCosts.join(', ')}`);
  if (input.energyLeaks?.length) lines.push(`${L ? 'Energielekken' : 'Energy leaks'}: ${input.energyLeaks.join(', ')}`);
  return lines.join('\n');
}

interface AiResponseShape {
  themeIds?: unknown;
  message?: unknown;
  rationaleByTheme?: unknown;
}

function parseAi(raw: string): { themeIds: string[]; message: string; rationaleByTheme: Record<string, string> } {
  // Strip code fences if any
  let body = raw.trim();
  if (body.startsWith('```')) {
    body = body.replace(/^```(json)?/i, '').replace(/```$/, '').trim();
  }
  let parsed: AiResponseShape;
  try {
    parsed = JSON.parse(body);
  } catch {
    // Try to grab a JSON object from the middle of the string
    const m = body.match(/\{[\s\S]*\}/);
    if (!m) throw new Error('AI response was not JSON');
    parsed = JSON.parse(m[0]);
  }
  const rawIds = Array.isArray(parsed.themeIds) ? parsed.themeIds : [];
  const themeIds = rawIds
    .filter((x): x is string => typeof x === 'string')
    .filter(id => VALID_THEME_IDS.has(id));
  const message = typeof parsed.message === 'string' ? parsed.message.trim() : '';
  const rationaleByTheme: Record<string, string> = {};
  if (parsed.rationaleByTheme && typeof parsed.rationaleByTheme === 'object') {
    for (const [k, v] of Object.entries(parsed.rationaleByTheme as Record<string, unknown>)) {
      if (VALID_THEME_IDS.has(k) && typeof v === 'string') rationaleByTheme[k] = v;
    }
  }
  return { themeIds, message, rationaleByTheme };
}

export interface AiRecommenderResult extends RecommenderResult {
  mode: 'ai';
  aiMessage: string;
  aiModel: string;
  aiLatencyMs: number;
  aiCostUsd: number;
}

export async function recommendThemesAi(input: RecommenderInput): Promise<AiRecommenderResult> {
  const language: Language = input.language === 'en' ? 'en' : 'nl';
  const cfg = readSettingsTyped();
  const topN = Math.max(1, Math.min(5, Number(cfg['recommender.top_n']) || 2));
  const model = (cfg['recommender.ai_model'] as string) || EVAL_MODEL;

  const system = buildSystemPrompt(language, topN);
  const user = summariseInput(input, language);

  const client = getOpenRouter();
  const startedAt = Date.now();
  const completion = await client.chat.completions.create({
    model,
    temperature: 0.4,
    max_tokens: 500,
    messages: [
      { role: 'system', content: system },
      { role: 'user',   content: user },
    ],
  });
  const latencyMs = Date.now() - startedAt;

  const choice = completion.choices[0]?.message?.content ?? '';
  const usage = completion.usage;
  const cost = usage ? calculateCost(model, usage.prompt_tokens ?? 0, usage.completion_tokens ?? 0) : 0;

  const { themeIds, message, rationaleByTheme } = parseAi(choice);

  // Build recommendations from validated theme IDs, in the order the model returned.
  const recommendations: Recommendation[] = themeIds.slice(0, topN).map((id, idx) => {
    const meta = UNTIRE_THEMES.find(t => t.id === id)!;
    return {
      themeId: id,
      nameNl: meta.nameNl,
      nameEn: meta.nameEn,
      score: 1 - idx * 0.15,
      rationale: rationaleByTheme[id] ?? '',
      matchedSignals: [],
    };
  });

  let fallbackUsed = false;
  let final = recommendations;
  if (final.length === 0) {
    fallbackUsed = true;
    const fb = UNTIRE_THEMES.find(t => t.id === 'introduction')!;
    final = [{
      themeId: fb.id,
      nameNl: fb.nameNl,
      nameEn: fb.nameEn,
      score: 0.5,
      rationale: language === 'nl' ? 'Een goed startpunt om het programma te leren kennen.' : 'A good starting point to get to know the programme.',
      matchedSignals: [],
    }];
  }

  return {
    recommendations: final,
    fallbackUsed,
    engineVersion: `ai:${model}`,
    language,
    mode: 'ai',
    aiMessage: message,
    aiModel: model,
    aiLatencyMs: latencyMs,
    aiCostUsd: cost,
  };
}
