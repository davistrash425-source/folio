// Which Claude model an agent uses, and what each one costs. Dollars per
// million tokens, from https://platform.claude.com/docs/en/about-claude/pricing
// (Haiku's price is for prompts up to 100,000 tokens, far above any run here).
export const HAIKU = "claude-haiku-5-5";
export const SONNET = "claude-sonnet-5-5";
export const OPUS = "claude-opus-5-5";

type Price = { input: number; output: number; cacheRead: number; cacheWrite: number };

const PRICES: Record<string, Price> = {
  [HAIKU]: { input: 0.1, output: 0.5, cacheRead: 0.01, cacheWrite: 0.125 },
  [SONNET]: { input: 2, output: 10, cacheRead: 0.2, cacheWrite: 2.5 },
  [OPUS]: { input: 4, output: 20, cacheRead: 0.2, cacheWrite: 5 },
};

export type Usage = { inputTokens: number; outputTokens: number; cacheReadTokens: number; cacheWriteTokens: number };

// The dearest of the models a refused request can fall back to, other than
// Fable, which a fallback doesn't use.
const UNKNOWN_MODEL: Price = { input: 5, output: 25, cacheRead: 0.5, cacheWrite: 6.25 };

// In millionths of a dollar, rounded up. A model not listed here (Anthropic can
// answer a refused request from another model) is charged at UNKNOWN_MODEL,
// so an unexpected one can't slip under the spending limit.
export function costMicros(model: string, usage: Usage) {
  const price = Object.hasOwn(PRICES, model) ? PRICES[model] : UNKNOWN_MODEL;
  return Math.ceil(
    usage.inputTokens * price.input +
      usage.outputTokens * price.output +
      usage.cacheReadTokens * price.cacheRead +
      usage.cacheWriteTokens * price.cacheWrite,
  );
}
