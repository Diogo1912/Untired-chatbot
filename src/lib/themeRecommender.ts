// Deterministic, rule-based theme recommender.
//
// Given the inputs the Untire Now app already collects (fatigue/energy/happiness
// scores, chosen goal + progress, and selected Energy IN / costs / leaks tags),
// score each of the 17 Untire themes and return the top N.
//
// No LLM is called in this path. All user-facing rationale strings come from
// the static `themeRules.json` knowledge base. This is the compliance lever:
// recommendations are configuration, not generation.

import rulesData from './themeRules.json';
import { UNTIRE_THEMES, type UntireTheme } from './untireContent';

// ─── Public types ────────────────────────────────────────────────────────────

export type Language = 'nl' | 'en';

export interface RecommenderInput {
  userId?: string;
  firstName?: string;
  fatigueScore?: number;
  fatigueAcceptable?: number;
  fatigueDesired?: number;
  happinessScore?: number;
  happinessAcceptable?: number;
  happinessDesired?: number;
  energyScore?: number;
  energyAcceptable?: number;
  energyDesired?: number;
  chosenGoal?: string;
  goalProgress?: number;
  energyIn?: string[];
  energyCosts?: string[];
  energyLeaks?: string[];
  language?: Language;
}

export interface Recommendation {
  themeId: string;
  nameNl: string;
  nameEn: string;
  score: number;
  rationale: string;
  matchedSignals: string[];
}

export interface RecommenderResult {
  recommendations: Recommendation[];
  fallbackUsed: boolean;
  engineVersion: string;
  language: Language;
}

// ─── Knowledge-base types (mirror themeRules.json) ──────────────────────────

interface WeightedTag { tag: string; weight: number }
interface WeightedPattern { pattern: string; weight: number }
type ScoreRule =
  | { metric: 'fatigue' | 'happiness' | 'energy'; op: 'gapAboveAcceptable' | 'gapBelowAcceptable' | 'gapBelowDesired' | 'gapAboveDesired'; thresholdPct: number; weight: number }
  | { metric: 'fatigue' | 'happiness' | 'energy'; op: 'absolute'; min: number; weight: number }
  | { metric: 'fatigue' | 'happiness' | 'energy'; op: 'absoluteBelow'; max: number; weight: number };

interface ThemeRule {
  themeId: string;
  signals: {
    energyLeakTags: WeightedTag[];
    energyCostTags: WeightedTag[];
    energyInTags: WeightedTag[];
    goalKeywords: WeightedPattern[];
    scoreRules: ScoreRule[];
  };
  rationaleNl: string;
  rationaleEn: string;
}

interface RulesFile {
  engineVersion: string;
  thresholds: { minScore: number; topN: number; fallbackThemeId: string };
  themes: ThemeRule[];
  tagCatalog: {
    energyIn: Array<{ id: string; labelNl: string; labelEn: string }>;
    energyCosts: Array<{ id: string; labelNl: string; labelEn: string }>;
    energyLeaks: Array<{ id: string; labelNl: string; labelEn: string }>;
  };
}

const rules = rulesData as unknown as RulesFile;

// ─── Tag catalog (re-exported so the UI can render the closed lists) ───────

export const TAG_CATALOG = rules.tagCatalog;
export const ENGINE_VERSION = rules.engineVersion;

// ─── Scoring ────────────────────────────────────────────────────────────────

function tagWeight(selected: string[] | undefined, weighted: WeightedTag[]): { score: number; matched: string[] } {
  if (!selected?.length) return { score: 0, matched: [] };
  const set = new Set(selected);
  let score = 0;
  const matched: string[] = [];
  for (const { tag, weight } of weighted) {
    if (set.has(tag)) {
      score += weight;
      matched.push(tag);
    }
  }
  return { score, matched };
}

function goalWeight(goal: string | undefined, patterns: WeightedPattern[]): { score: number; matched: string[] } {
  if (!goal) return { score: 0, matched: [] };
  let score = 0;
  const matched: string[] = [];
  for (const { pattern, weight } of patterns) {
    try {
      if (new RegExp(pattern, 'i').test(goal)) {
        score += weight;
        matched.push(`goal:${pattern}`);
      }
    } catch {
      // Bad pattern in the knowledge base — skip silently rather than crash.
    }
  }
  return { score, matched };
}

function pickMetric(input: RecommenderInput, metric: ScoreRule['metric']) {
  switch (metric) {
    case 'fatigue':   return { score: input.fatigueScore,   acceptable: input.fatigueAcceptable,   desired: input.fatigueDesired };
    case 'happiness': return { score: input.happinessScore, acceptable: input.happinessAcceptable, desired: input.happinessDesired };
    case 'energy':    return { score: input.energyScore,    acceptable: input.energyAcceptable,    desired: input.energyDesired };
  }
}

function scoreRuleWeight(input: RecommenderInput, rule: ScoreRule): { score: number; matched: string[] } {
  const m = pickMetric(input, rule.metric);
  if (m.score == null) return { score: 0, matched: [] };
  let hit = false;
  if (rule.op === 'absolute') {
    hit = m.score >= rule.min;
  } else if (rule.op === 'absoluteBelow') {
    hit = m.score <= rule.max;
  } else {
    const ref =
      rule.op === 'gapAboveAcceptable' || rule.op === 'gapBelowAcceptable' ? m.acceptable :
      m.desired;
    if (ref == null || ref === 0) return { score: 0, matched: [] };
    const diff =
      rule.op === 'gapAboveAcceptable' ? m.score - ref :
      rule.op === 'gapBelowAcceptable' ? ref - m.score :
      rule.op === 'gapBelowDesired'    ? ref - m.score :
      m.score - ref; // gapAboveDesired
    const pct = (diff / Math.max(1, Math.abs(ref))) * 100;
    hit = pct >= rule.thresholdPct;
  }
  if (!hit) return { score: 0, matched: [] };
  return { score: rule.weight, matched: [`metric:${rule.metric}:${rule.op}`] };
}

function maxPossibleScore(rule: ThemeRule): number {
  const sum = (xs: { weight: number }[]) => xs.reduce((a, b) => a + b.weight, 0);
  return (
    sum(rule.signals.energyLeakTags) +
    sum(rule.signals.energyCostTags) +
    sum(rule.signals.energyInTags) +
    sum(rule.signals.goalKeywords) +
    sum(rule.signals.scoreRules)
  );
}

function themeMeta(themeId: string): UntireTheme | undefined {
  return UNTIRE_THEMES.find(t => t.id === themeId);
}

// ─── Public API ────────────────────────────────────────────────────────────

export function recommendThemes(input: RecommenderInput): RecommenderResult {
  const language: Language = input.language === 'en' ? 'en' : 'nl';

  const scored = rules.themes.map(rule => {
    const leaks = tagWeight(input.energyLeaks, rule.signals.energyLeakTags);
    const costs = tagWeight(input.energyCosts, rule.signals.energyCostTags);
    const ins   = tagWeight(input.energyIn,    rule.signals.energyInTags);
    const goal  = goalWeight(input.chosenGoal, rule.signals.goalKeywords);
    const metrics = rule.signals.scoreRules.map(r => scoreRuleWeight(input, r));

    const raw =
      leaks.score + costs.score + ins.score + goal.score +
      metrics.reduce((a, b) => a + b.score, 0);

    const max = maxPossibleScore(rule) || 1;
    const score = Math.min(1, raw / max);

    const matchedSignals = [
      ...leaks.matched.map(t => `leak:${t}`),
      ...costs.matched.map(t => `cost:${t}`),
      ...ins.matched.map(t => `in:${t}`),
      ...goal.matched,
      ...metrics.flatMap(m => m.matched),
    ];

    const meta = themeMeta(rule.themeId);
    return {
      themeId: rule.themeId,
      nameNl: meta?.nameNl ?? rule.themeId,
      nameEn: meta?.nameEn ?? rule.themeId,
      score,
      rationale: language === 'nl' ? rule.rationaleNl : rule.rationaleEn,
      matchedSignals,
    };
  });

  scored.sort((a, b) => b.score - a.score);

  const { minScore, topN, fallbackThemeId } = rules.thresholds;
  const above = scored.filter(s => s.score >= minScore).slice(0, topN);

  let fallbackUsed = false;
  let recommendations = above;
  if (recommendations.length === 0) {
    fallbackUsed = true;
    const fb = scored.find(s => s.themeId === fallbackThemeId);
    if (fb) recommendations = [fb];
  }

  return {
    recommendations,
    fallbackUsed,
    engineVersion: rules.engineVersion,
    language,
  };
}
