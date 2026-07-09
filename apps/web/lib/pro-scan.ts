import { createAnthropicClient, createAnthropicTokenCounter, type CheckContext } from "@beacon/core";
import { readSession } from "./session";
import { entitlements } from "./entitlements";
import type { ScanOptions } from "./scan";

let warnedMisconfig = false;

/**
 * Resolve scan options for a request:
 *  - Free / signed-out → deterministic public scan (server token if any).
 *  - Pro → the user's GitHub token (private repos) + managed LLM (BEACON_MANAGED_ANTHROPIC_KEY),
 *    so TRIGGER-01 and exact token counts run without the user supplying a key.
 */
export async function resolveScanOptions(req: Request): Promise<ScanOptions & { pro: boolean }> {
  const session = readSession(req);
  // Fail CLOSED: the identity cookie is only unforgeable when BEACON_SESSION_SECRET signs it. If the
  // deploy has privilege at stake (managed-LLM key, or a real entitlements DB) but no secret is set,
  // do NOT trust the login for Pro — otherwise a forged `beacon_user` cookie buys managed-LLM spend
  // on the server key. (Structural safety, not a documentation convention.)
  const identityVerifiable = Boolean(process.env.BEACON_SESSION_SECRET);
  const privilegeAtStake = Boolean(process.env.BEACON_MANAGED_ANTHROPIC_KEY) || Boolean(process.env.DATABASE_URL);
  if (privilegeAtStake && !identityVerifiable) {
    if (!warnedMisconfig) {
      warnedMisconfig = true;
      console.warn(
        "[beacon] Pro is disabled: BEACON_SESSION_SECRET is unset but a managed key / DATABASE_URL is configured. Set BEACON_SESSION_SECRET to enable Pro securely.",
      );
    }
    return { pro: false };
  }
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
