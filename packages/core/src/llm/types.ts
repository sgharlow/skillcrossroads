/**
 * Model-agnostic LLM interface. Beacon's LLM-assisted checks depend only on `ModelClient`, so
 * the provider (Anthropic today) can be swapped without touching check logic — the Build Bible's
 * "not locked to one provider" requirement.
 */

/** A JSON-Schema object describing the structured verdict a check expects back. */
export type JsonSchema = Record<string, unknown>;

export interface StructuredRequest {
  /** System prompt establishing the evaluator's role and rubric. */
  readonly system: string;
  /** The user-turn content to evaluate. */
  readonly prompt: string;
  /** Name of the tool the model is forced to call. */
  readonly toolName: string;
  /** One-line description of what the tool reports. */
  readonly toolDescription: string;
  /** JSON schema for the tool input — this is the verdict shape. */
  readonly schema: JsonSchema;
  /**
   * Output-token budget for the structured call. Optional — implementations default to a small
   * verdict-sized cap. Set it higher for outputs that carry text blocks (e.g. fix suggestions),
   * where a truncated tool call silently parses to nothing.
   */
  readonly maxTokens?: number;
}

export interface ModelClient {
  /** Stable identifier used in cache keys (e.g. the model id). */
  readonly name: string;
  /**
   * Ask the model to produce a structured object matching `schema`. Implementations force a
   * tool call so the result is guaranteed to validate. Returns the parsed object.
   * Throws on network/auth/parse failure.
   */
  generateStructured(req: StructuredRequest): Promise<unknown>;
}
