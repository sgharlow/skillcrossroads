import { API_VERSION, ModelError } from "./anthropic.js";

/**
 * Deterministic token estimate divisor. Calibrated against count_tokens on real skills
 * (`npm run eval:tokens`): skill markdown tokenizes denser than prose (~2.3–3.4 chars/token,
 * code-heavy skills lowest), so this is a rough centre — expect ±15–20% per skill. It is always
 * LABELLED as an estimate. For an exact figure (within ±5% of `/context`), a key enables the
 * AnthropicTokenCounter, the tokenizer `/context` itself uses.
 */
export const CHARS_PER_TOKEN = 3.0;

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

/** Counts tokens in text. `accurate` is true only for the real-tokenizer (API) counter. */
export interface TokenCounter {
  readonly accurate: boolean;
  count(text: string): Promise<number>;
}

/** The zero-dependency, offline estimate. */
export const heuristicCounter: TokenCounter = {
  accurate: false,
  count: (text) => Promise.resolve(estimateTokens(text)),
};

export interface AnthropicTokenCounterOptions {
  apiKey: string;
  model?: string;
  fetchImpl?: typeof fetch;
}

const COUNT_URL = "https://api.anthropic.com/v1/messages/count_tokens";

/**
 * Exact token count via Anthropic's count_tokens endpoint — the same tokenizer `/context` uses.
 * BYOK. Model-specific (tokenization differs by model family).
 */
export function createAnthropicTokenCounter(opts: AnthropicTokenCounterOptions): TokenCounter {
  const model = opts.model ?? "claude-opus-4-8";
  const doFetch = opts.fetchImpl ?? fetch;
  return {
    accurate: true,
    async count(text: string): Promise<number> {
      const res = await doFetch(COUNT_URL, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": opts.apiKey,
          "anthropic-version": API_VERSION,
        },
        body: JSON.stringify({ model, messages: [{ role: "user", content: text || " " }] }),
      });
      if (!res.ok) {
        const t = await res.text().catch(() => "");
        throw new ModelError(`count_tokens ${res.status}: ${t.slice(0, 200)}`);
      }
      const json = (await res.json()) as { input_tokens?: number };
      if (typeof json.input_tokens !== "number") throw new ModelError("count_tokens: no input_tokens");
      return json.input_tokens;
    },
  };
}
