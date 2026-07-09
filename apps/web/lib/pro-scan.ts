import { createAnthropicClient, createAnthropicTokenCounter, type CheckContext } from "@beacon/core";
import { readSession } from "./session";
import { entitlements } from "./entitlements";
import type { ScanOptions } from "./scan";

/**
 * Resolve scan options for a request:
 *  - Free / signed-out → deterministic public scan (server token if any).
 *  - Pro → the user's GitHub token (private repos) + managed LLM (BEACON_MANAGED_ANTHROPIC_KEY),
 *    so TRIGGER-01 and exact token counts run without the user supplying a key.
 */
export async function resolveScanOptions(req: Request): Promise<ScanOptions & { pro: boolean }> {
  const session = readSession(req);
  const pro = session.login ? await entitlements.isPro(session.login) : false;
  if (!pro) return { pro: false };

  const opts: ScanOptions & { pro: boolean } = { pro: true };
  if (session.token) opts.token = session.token; // private-repo access

  const managedKey = process.env.BEACON_MANAGED_ANTHROPIC_KEY;
  if (managedKey) {
    const model = process.env.BEACON_MODEL;
    const ctx: CheckContext = {
      model: createAnthropicClient({ apiKey: managedKey, model }),
      tokenCounter: createAnthropicTokenCounter({ apiKey: managedKey, model }),
    };
    opts.ctx = ctx;
  }
  return opts;
}
