import OpenAI from 'openai';

const PRIMARY_MODEL = process.env.PRIMARY_MODEL ?? 'anthropic/claude-sonnet-4-5';
const EVAL_MODEL = process.env.EVAL_MODEL ?? 'anthropic/claude-haiku-4-5';
const EMBEDDING_MODEL = process.env.EMBEDDING_MODEL ?? 'openai/text-embedding-3-small';

// Models the user can pick from in the UI.
// `id` is the OpenRouter model id used at call time.
export const SELECTABLE_MODELS = [
  {
    id: PRIMARY_MODEL,
    label: 'Claude Sonnet 4.5',
    description: 'Balanced default — fast, empathetic, cost-efficient.',
  },
  {
    id: 'anthropic/claude-opus-4-7',
    label: 'Claude Opus 4.7',
    description: 'Most capable — deeper reasoning, higher cost and latency.',
  },
] as const;

export type SelectableModelId = (typeof SELECTABLE_MODELS)[number]['id'];

// Cost per 1M tokens (in USD) — configurable via env vars, defaults to OpenRouter pricing
const COST_MAP: Record<string, { input: number; output: number }> = {
  [PRIMARY_MODEL]: {
    input: parseFloat(process.env.PRIMARY_COST_INPUT ?? '3.0'),
    output: parseFloat(process.env.PRIMARY_COST_OUTPUT ?? '15.0'),
  },
  [EVAL_MODEL]: {
    input: parseFloat(process.env.EVAL_COST_INPUT ?? '0.8'),
    output: parseFloat(process.env.EVAL_COST_OUTPUT ?? '4.0'),
  },
  'anthropic/claude-opus-4-7': {
    input: parseFloat(process.env.OPUS_COST_INPUT ?? '15.0'),
    output: parseFloat(process.env.OPUS_COST_OUTPUT ?? '75.0'),
  },
};

export function getOpenRouter() {
  return new OpenAI({
    apiKey: process.env.OPENROUTER_API_KEY!,
    baseURL: 'https://openrouter.ai/api/v1',
    defaultHeaders: {
      'HTTP-Referer': 'https://untirecoach.app',
      'X-Title': 'Untire Coach',
    },
  });
}

export function calculateCost(model: string, tokensIn: number, tokensOut: number): number {
  const rates = COST_MAP[model] ?? { input: 3.0, output: 15.0 };
  return (tokensIn / 1_000_000) * rates.input + (tokensOut / 1_000_000) * rates.output;
}

// Validate a user-supplied model id against the selectable list.
// Returns the id if allowed, otherwise the default PRIMARY_MODEL.
export function resolveModel(modelId: string | null | undefined): string {
  if (!modelId) return PRIMARY_MODEL;
  return SELECTABLE_MODELS.some(m => m.id === modelId) ? modelId : PRIMARY_MODEL;
}

export { PRIMARY_MODEL, EVAL_MODEL, EMBEDDING_MODEL };
