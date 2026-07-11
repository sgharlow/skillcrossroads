import { createAnthropicClient, createAnthropicTokenCounter, createMemoryCache, type CheckContext } from "@beacon/core";
import { readSession, trustLogin } from "./session";
import { entitlements } from "./entitlements";
import type { ScanOptions } from "./scan";

let warnedMisconfig = false;

/**
 * Per-instance verdict/suggestion cache for the managed-LLM ctx (content-hash keyed, like the
 * CLI's file cache). Module-level singleton: without it, every Pro ?suggest=1 reload of an
 * UNCHANGED artifact re-runs full managed-key generations — uncached server-side LLM spend.
 */
const managedLlmCache = createMemoryCache();

/**
 * Resolve scan options for a request:
 *  - Free / signed-out → deterministic public scan (server token if any).
 *  - Pro → the user's GitHub token (private repos) + managed LLM (BEACON_MANAGED_ANTHROPIC_KEY),
 *    so TRIGGER-01 and exact token counts run without the user supplying a key.
 */
export async function resolveScanOptions(req: Request): Promise<ScanOptions & { pro: boolean }> {
  const session = readSession(req);
  // Fail CLOSED via the shared identity guard: the `beacon_user` cookie is only unforgeable when
  // BEACON_SESSION_SECRET signs it. With managed-LLM spend or a real entitlements DB at stake but no
  // secret, a forged cookie must not buy Pro. `trustLogin` centralizes that decision (also used by
  // billing/checkout/account); we still warn once so the misconfiguration is visible in logs.
  const privilegeAtStake = Boolean(process.env.BEACON_MANAGED_ANTHROPIC_KEY) || Boolean(process.env.DATABASE_URL);
  if (privilegeAtStake && !process.env.BEACON_SESSION_SECRET && !warnedMisconfig) {
    warnedMisconfig = true;
    console.warn(
      "[beacon] Pro is disabled: BEACON_SESSION_SECRET is unset but a managed key / DATABASE_URL is configured. Set BEACON_SESSION_SECRET to enable Pro securely.",
    );
  }
  const login = trustLogin(session.login, privilegeAtStake);
  const pro = login ? await entitlements.isPro(login) : false;
  if (!pro) return { pro: false };

  const opts: ScanOptions & { pro: boolean } = { pro: true };
  if (session.token) opts.token = session.token; // private-repo access

  const managedKey = process.env.BEACON_MANAGED_ANTHROPIC_KEY;
  if (managedKey) {
    const model = process.env.BEACON_MODEL;
    const ctx: CheckContext = {
      model: createAnthropicClient({ apiKey: managedKey, model }),
      tokenCounter: createAnthropicTokenCounter({ apiKey: managedKey, model }),
      cache: managedLlmCache,
    };
    opts.ctx = ctx;
  }
  return opts;
}
