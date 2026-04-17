// ─────────────────────────────────────────────────────────────────────────────
// Canonical source of truth for what exists inside the Untire Now app.
//
// This list is authoritative. The AI coach must only reference themes,
// exercises, and features from this file. If the user asks about something not
// on this list, the coach must say it is not part of Untire Now rather than
// inventing or guessing a name.
//
// Update this file (and only this file) when new content ships in the app.
// ─────────────────────────────────────────────────────────────────────────────

export interface UntireTheme {
  /** Stable machine id used by tool enums. Never shown to users. */
  id: string;
  /** Official Dutch name shown in the app. Use verbatim in Dutch conversations. */
  nameNl: string;
  /** Official English name. Use verbatim in English conversations. */
  nameEn: string;
  /** One-line description for humans reading logs — NOT shown to the model as a definition. */
  blurb: string;
}

export const UNTIRE_THEMES: UntireTheme[] = [
  { id: 'introduction',         nameNl: 'Introductie',              nameEn: 'Introduction about Untire',   blurb: 'Intro to the programme' },
  { id: 'fatigue',              nameNl: 'Vermoeidheid',             nameEn: 'Fatigue',                     blurb: 'Understanding CRF' },
  { id: 'building_up_reserve',  nameNl: 'Reserves opbouwen',        nameEn: 'Building up reserve',         blurb: 'Strength and stamina basics' },
  { id: 'dealing_with_problems',nameNl: 'Omgaan met problemen',     nameEn: 'Dealing with problems',       blurb: 'The 6-step plan' },
  { id: 'managing_energy',      nameNl: 'Energie managen',          nameEn: 'Managing energy',             blurb: 'Energy budgeting and pacing' },
  { id: 'adjust_and_process',   nameNl: 'Aanpassen & verwerken',    nameEn: 'Adjust & process',            blurb: 'Adjusting to a new reality' },
  { id: 'stress',               nameNl: 'Stress',                   nameEn: 'Stress',                      blurb: 'Coping with tension' },
  { id: 'anxiety',              nameNl: 'Angst',                    nameEn: 'Anxiety',                     blurb: 'Understanding anxiety' },
  { id: 'depression',           nameNl: 'Depressie',                nameEn: 'Depression',                  blurb: 'Recognising low mood' },
  { id: 'worrying',             nameNl: 'Piekeren',                 nameEn: 'Worrying',                    blurb: 'Getting out of your head' },
  { id: 'sleep',                nameNl: 'Slaap',                    nameEn: 'Sleep',                       blurb: 'Sleep and fatigue' },
  { id: 'boundaries',           nameNl: 'Grenzen',                  nameEn: 'Boundaries',                  blurb: 'Saying no, standing up for yourself' },
  { id: 'pain',                 nameNl: 'Pijn',                     nameEn: 'Pain',                        blurb: 'Living with pain' },
  { id: 'work',                 nameNl: 'Werk',                     nameEn: 'Work',                        blurb: 'Returning to or managing work' },
  { id: 'selfcare',             nameNl: 'Zelfzorg',                 nameEn: 'Selfcare',                    blurb: 'Looking after yourself' },
  { id: 'nutrition',            nameNl: 'Voeding',                  nameEn: 'Nutrition',                   blurb: 'Food and energy' },
  { id: 'resilience',           nameNl: 'Veerkracht',               nameEn: 'Resilience',                  blurb: 'Building resilience' },
];

export interface UntireExercise {
  id: string;
  nameNl: string;
  nameEn: string;
}

export const UNTIRE_EXERCISES: UntireExercise[] = [
  { id: 'relaxation', nameNl: 'Ontspanning / meditatie', nameEn: 'Relaxation / meditation' },
  { id: 'fitness',    nameNl: 'Fitness',                 nameEn: 'Fitness' },
  { id: 'strength',   nameNl: 'Kracht',                  nameEn: 'Strength' },
];

/** Also available in the app: a Tips section alongside themes and exercises. */
export const UNTIRE_TIPS = {
  nameNl: 'Tips',
  nameEn: 'Tips',
};

export const UNTIRE_THEME_IDS = UNTIRE_THEMES.map(t => t.id);
export const UNTIRE_EXERCISE_IDS = UNTIRE_EXERCISES.map(e => e.id);

/**
 * Block of text injected verbatim into every system prompt so the model only
 * has one authoritative list of what exists in the app.
 */
// ─────────────────────────────────────────────────────────────────────────────
// Post-generation scrub for known-fabricated feature / theme names.
//
// This is a defence-in-depth layer AFTER prompt constraints. It replaces the
// most commonly hallucinated names with generic phrasing so that even if the
// model ignores the inventory, the user never sees a made-up feature name
// like "activity planner" or a made-up theme like "sexuality".
// ─────────────────────────────────────────────────────────────────────────────

// Each entry: regex → replacement. Case-insensitive, word-boundary anchored.
// Replacements are intentionally generic and short so they don't break grammar badly.
const FABRICATED_TERMS: Array<{ pattern: RegExp; replaceNl: string; replaceEn: string }> = [
  // Fabricated features
  { pattern: /\bactivity planner\b/gi,     replaceNl: 'een onderdeel in de app', replaceEn: 'a section of the app' },
  { pattern: /\bactiviteitenplanner\b/gi,  replaceNl: 'een onderdeel in de app', replaceEn: 'a section of the app' },
  { pattern: /\bpacing guide\b/gi,         replaceNl: 'een onderdeel in de app', replaceEn: 'a section of the app' },
  { pattern: /\bpacing-?gids\b/gi,         replaceNl: 'een onderdeel in de app', replaceEn: 'a section of the app' },
  { pattern: /\bsleep tracker\b/gi,        replaceNl: 'een onderdeel in de app', replaceEn: 'a section of the app' },
  { pattern: /\bslaaptracker\b/gi,         replaceNl: 'een onderdeel in de app', replaceEn: 'a section of the app' },
  { pattern: /\benergy map\b/gi,           replaceNl: 'een onderdeel in de app', replaceEn: 'a section of the app' },
  { pattern: /\benergiekaart\b/gi,         replaceNl: 'een onderdeel in de app', replaceEn: 'a section of the app' },
  { pattern: /\bvat van energie\b/gi,      replaceNl: 'een onderdeel in de app', replaceEn: 'a section of the app' },
  { pattern: /\bvase of energy\b/gi,       replaceNl: 'een onderdeel in de app', replaceEn: 'a section of the app' },
  { pattern: /\bmood tracker\b/gi,         replaceNl: 'een onderdeel in de app', replaceEn: 'a section of the app' },
  { pattern: /\bgoal tracker\b/gi,         replaceNl: 'een onderdeel in de app', replaceEn: 'a section of the app' },
  { pattern: /\bjournal(ing)? feature\b/gi,replaceNl: 'een onderdeel in de app', replaceEn: 'a section of the app' },

  // Fabricated themes
  { pattern: /\brelationships?\s+theme\b/gi, replaceNl: 'een thema in de app', replaceEn: 'a theme in the app' },
  { pattern: /\brelaties\s+thema\b/gi,       replaceNl: 'een thema in de app', replaceEn: 'a theme in the app' },
  { pattern: /\bsexuality\s+theme\b/gi,      replaceNl: 'een thema in de app', replaceEn: 'a theme in the app' },
  { pattern: /\bseksualiteit\s+thema\b/gi,   replaceNl: 'een thema in de app', replaceEn: 'a theme in the app' },
  { pattern: /\bcommunication\s+theme\b/gi,  replaceNl: 'een thema in de app', replaceEn: 'a theme in the app' },
  { pattern: /\bcommunicatie\s+thema\b/gi,   replaceNl: 'een thema in de app', replaceEn: 'a theme in the app' },
  { pattern: /\bbody[- ]image\s+theme\b/gi,  replaceNl: 'een thema in de app', replaceEn: 'a theme in the app' },
  { pattern: /\bzingeving\s+thema\b/gi,      replaceNl: 'een thema in de app', replaceEn: 'a theme in the app' },
  { pattern: /\bpacing\s+thema\b/gi,         replaceNl: 'een thema in de app', replaceEn: 'a theme in the app' },
];

export function scrubFabricatedContent(text: string, language: 'nl' | 'en'): { scrubbed: string; hits: string[] } {
  if (!text) return { scrubbed: text, hits: [] };
  let out = text;
  const hits: string[] = [];
  for (const { pattern, replaceNl, replaceEn } of FABRICATED_TERMS) {
    const matches = out.match(pattern);
    if (matches) {
      hits.push(...matches);
      out = out.replace(pattern, language === 'nl' ? replaceNl : replaceEn);
    }
  }
  return { scrubbed: out, hits };
}

export function buildContentInventoryBlock(language: 'nl' | 'en'): string {
  const themeLines = UNTIRE_THEMES.map(t => `  - ${language === 'nl' ? t.nameNl : t.nameEn}`).join('\n');
  const exerciseLines = UNTIRE_EXERCISES.map(e => `  - ${language === 'nl' ? e.nameNl : e.nameEn}`).join('\n');
  const tipsLabel = language === 'nl' ? UNTIRE_TIPS.nameNl : UNTIRE_TIPS.nameEn;

  return `AUTHORITATIVE UNTIRE NOW CONTENT INVENTORY (this is the ONLY content that exists in the app — do not name anything else):

Themes (${UNTIRE_THEMES.length}):
${themeLines}

Exercise categories:
${exerciseLines}

Plus: ${tipsLabel}.

HALLUCINATION GUARD — read carefully:
- You may ONLY reference themes, exercises, or features from the list above. Nothing else exists in Untire Now.
- Do NOT invent features (there is no "activity planner", "pacing guide", "sleep tracker", "energy map", "mood tracker", "journal", "goal tracker", or any other tool not on the list).
- Do NOT invent themes (there is no "relationships", "sexuality", "communication", "body image", "meaning", "cognitive functioning", "social support", "identity", or any other theme not on the list above).
- If the user asks about a topic that is not covered by any listed theme, say clearly that it is not part of Untire Now today, rather than guessing a name.
- If you are not sure whether something exists, describe it generically ("a section in the app") instead of naming it.
- When you DO reference something from the list, use the EXACT name as written above — no translation, shortening, or paraphrasing.`;
}
