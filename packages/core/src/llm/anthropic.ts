import type { ModelClient, StructuredRequest } from "./types.js";

/** Default model. Overridable via BEACON_MODEL. Opus-tier per the Anthropic API guidance. */
export const DEFAULT_MODEL = "claude-opus-4-8";

const API_URL = "https://api.anthropic.com/v1/messages";
/** Anthropic API version header value, shared across API callers. */
export const API_VERSION = "2023-06-01";

export interface AnthropicClientOptions {
  /** BYOK Anthropic API key. */
  apiKey: string;
  /** Model id. Defaults to DEFAULT_MODEL / BEACON_MODEL. */
  model?: string;
  /** Injectable fetch (for tests). Defaults to global fetch. */
  fetchImpl?: typeof fetch;
  /** Request timeout in ms. */
  timeoutMs?: number;
}

export class ModelError extends Error {}

/**
 * Anthropic Messages API client that returns structured output by forcing a strict tool call.
 * Uses raw fetch so @beacon/core stays dependency-free and provider-swappable.
 */
export function createAnthropicClient(opts: AnthropicClientOptions): ModelClient {
  const model = opts.model ?? DEFAULT_MODEL;
  const doFetch = opts.fetchImpl ?? fetch;
  const defaultTimeoutMs = opts.timeoutMs ?? 30_000;

  return {
    name: model,
    async generateStructured(req: StructuredRequest): Promise<unknown> {
      // Per-request override (e.g. 8192-token suggestion generations outlast a verdict timeout).
      const timeoutMs = req.timeoutMs ?? defaultTimeoutMs;
      const body = {
        model,
        max_tokens: req.maxTokens ?? 1024,
        system: req.system,
        messages: [{ role: "user", content: req.prompt }],
        tools: [
          {
            name: req.toolName,
            description: req.toolDescription,
            input_schema: req.schema,
            strict: true,
          },
        ],
        tool_choice: { type: "tool", name: req.toolName },
      };

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      let res: Response;
      try {
        res = await doFetch(API_URL, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-api-key": opts.apiKey,
            "anthropic-version": API_VERSION,
          },
          body: JSON.stringify(body),
          signal: controller.signal,
        });
      } catch (err) {
        throw new ModelError(`Request failed: ${err instanceof Error ? err.message : String(err)}`);
      } finally {
        clearTimeout(timer);
      }

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new ModelError(`Anthropic API ${res.status}: ${text.slice(0, 300)}`);
      }

      const json = (await res.json()) as {
        stop_reason?: string;
        content?: Array<{ type: string; name?: string; input?: unknown }>;
      };
      if (json.stop_reason === "refusal") {
        throw new ModelError("Model refused the request.");
      }
      const toolUse = json.content?.find((b) => b.type === "tool_use" && b.name === req.toolName);
      if (!toolUse || toolUse.input === undefined) {
        throw new ModelError("Model did not return the expected structured tool call.");
      }
      return toolUse.input;
    },
  };
}
