import OpenAI from 'openai';

const PRIMARY_MODEL = process.env.PRIMARY_MODEL ?? 'anthropic/claude-sonnet-4-5';
const EVAL_MODEL = process.env.EVAL_MODEL ?? 'anthropic/claude-haiku-4-5';
const EMBEDDING_MODEL = process.env.EMBEDDING_MODEL ?? 'openai/text-embedding-3-small';

// Cost per 1M tokens (in USD) — approximate OpenRouter pricing
const COST_MAP: Record<string, { input: number; output: number }> = {
  'anthropic/claude-sonnet-4-5': { input: 3.0, output: 15.0 },
  'anthropic/claude-haiku-4-5': { input: 0.8, output: 4.0 },
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

export { PRIMARY_MODEL, EVAL_MODEL, EMBEDDING_MODEL };
