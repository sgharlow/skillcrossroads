import { describe, it, expect } from "vitest";
import { createAnthropicClient, DEFAULT_MODEL, ModelError } from "../src/llm/anthropic.js";
import type { StructuredRequest } from "../src/llm/types.js";

const req: StructuredRequest = {
  system: "sys",
  prompt: "user",
  toolName: "report_verdict",
  toolDescription: "desc",
  schema: { type: "object", additionalProperties: false, properties: {}, required: [] },
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

describe("createAnthropicClient", () => {
  it("forces a tool call and returns the tool input", async () => {
    let captured: { url: string; body: any } | undefined;
    const fetchImpl = (async (url: string, init: RequestInit) => {
      captured = { url, body: JSON.parse(init.body as string) };
      return jsonResponse({
        stop_reason: "tool_use",
        content: [{ type: "tool_use", name: "report_verdict", input: { score: 91 } }],
      });
    }) as unknown as typeof fetch;

    const client = createAnthropicClient({ apiKey: "sk-test", model: "claude-opus-4-8", fetchImpl });
    const out = await client.generateStructured(req);

    expect(out).toEqual({ score: 91 });
    expect(captured?.url).toContain("/v1/messages");
    expect(captured?.body.tool_choice).toEqual({ type: "tool", name: "report_verdict" });
    expect(captured?.body.tools[0].strict).toBe(true);
    expect(captured?.body.model).toBe("claude-opus-4-8");
  });

  it("defaults to the documented model", () => {
    expect(createAnthropicClient({ apiKey: "x" }).name).toBe(DEFAULT_MODEL);
  });

  it("throws ModelError on a non-2xx response", async () => {
    const fetchImpl = (async () => new Response("nope", { status: 401 })) as unknown as typeof fetch;
    const client = createAnthropicClient({ apiKey: "bad", fetchImpl });
    await expect(client.generateStructured(req)).rejects.toBeInstanceOf(ModelError);
  });

  it("throws when the model refuses", async () => {
    const fetchImpl = (async () => jsonResponse({ stop_reason: "refusal", content: [] })) as unknown as typeof fetch;
    const client = createAnthropicClient({ apiKey: "x", fetchImpl });
    await expect(client.generateStructured(req)).rejects.toThrow(/refus/i);
  });

  it("throws when no tool call is returned", async () => {
    const fetchImpl = (async () =>
      jsonResponse({ stop_reason: "end_turn", content: [{ type: "text", text: "hi" }] })) as unknown as typeof fetch;
    const client = createAnthropicClient({ apiKey: "x", fetchImpl });
    await expect(client.generateStructured(req)).rejects.toThrow(/structured tool call/i);
  });
});
