// Admin-tunable global app settings (live in app_settings DB table).
// Each entry has a stable key, a human label, a type, and a default.
// `read()` returns the typed value (DB override > default).

import { getAllAppSettings, setAppSettings } from './db';

export type SettingType = 'string' | 'number' | 'boolean' | 'enum';

export interface SettingDef {
  key: string;
  label: string;
  group: 'coach' | 'recommender' | 'general';
  type: SettingType;
  default: string | number | boolean;
  options?: { value: string; label: string }[]; // for enum
  min?: number; max?: number; step?: number;     // for number
  description?: string;
}

export const SETTING_DEFS: SettingDef[] = [
  // General
  { key: 'general.product_name', label: 'Product name', group: 'general', type: 'string', default: 'Untire', description: 'Shown in browser tab and select headers.' },
  // Coach
  { key: 'coach.default_language', label: 'Default language', group: 'coach', type: 'enum', default: 'nl',
    options: [{ value: 'nl', label: 'Nederlands' }, { value: 'en', label: 'English' }] },
  { key: 'coach.default_model', label: 'Default primary model', group: 'coach', type: 'enum', default: 'anthropic/claude-sonnet-4-5',
    options: [
      { value: 'anthropic/claude-sonnet-4-5', label: 'Claude Sonnet 4.5' },
      { value: 'anthropic/claude-opus-4-7',   label: 'Claude Opus 4.7' },
    ],
    description: 'Used for new users until they pick a different model in Customise.' },
  { key: 'coach.show_breathing_default',  label: 'Show breathing animation (default)', group: 'coach', type: 'boolean', default: true },
  { key: 'coach.show_app_features_default', label: 'Surface in-app feature references (default)', group: 'coach', type: 'boolean', default: true },
  { key: 'coach.max_reflection_sentences', label: 'Max sentences in reflection step', group: 'coach', type: 'number', default: 4, min: 1, max: 8, step: 1,
    description: 'Used by the eval to flag overlong reflections. Code path also reads this.' },
  // Recommender
  { key: 'recommender.min_score',     label: 'Minimum match score (0–1)', group: 'recommender', type: 'number', default: 0.18, min: 0, max: 1, step: 0.01,
    description: 'Themes scoring below this fall back to the default theme.' },
  { key: 'recommender.top_n',         label: 'Number of recommendations', group: 'recommender', type: 'number', default: 2, min: 1, max: 5, step: 1 },
  { key: 'recommender.fallback_theme', label: 'Fallback theme', group: 'recommender', type: 'enum', default: 'introduction',
    options: [
      { value: 'introduction',        label: 'Introduction' },
      { value: 'managing_energy',     label: 'Managing energy' },
      { value: 'fatigue',             label: 'Fatigue' },
      { value: 'selfcare',            label: 'Selfcare' },
      { value: 'resilience',          label: 'Resilience' },
    ] },
  { key: 'recommender.show_signals',  label: 'Show matched-signals trace to end users', group: 'recommender', type: 'boolean', default: true,
    description: 'When off, the UI hides the "Signals that contributed" expander.' },
];

function defaultsAsRecord(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const d of SETTING_DEFS) out[d.key] = String(d.default);
  return out;
}

export function readAllSettings(): Record<string, string> {
  return { ...defaultsAsRecord(), ...getAllAppSettings() };
}

export function readSettingsTyped(): Record<string, string | number | boolean> {
  const raw = readAllSettings();
  const out: Record<string, string | number | boolean> = {};
  for (const def of SETTING_DEFS) {
    const v = raw[def.key];
    if (def.type === 'boolean') out[def.key] = v === 'true' || v === '1';
    else if (def.type === 'number') out[def.key] = Number(v);
    else out[def.key] = v;
  }
  return out;
}

export function writeSettings(patch: Record<string, string>) {
  // Validate keys against defs
  const allowed = new Set(SETTING_DEFS.map(d => d.key));
  const clean: Record<string, string> = {};
  for (const [k, v] of Object.entries(patch)) {
    if (!allowed.has(k)) continue;
    clean[k] = String(v);
  }
  setAppSettings(clean);
}
