/**
 * MCP Phase A — `.mcp.json` config hygiene (deterministic, evidence-cited).
 * Scope per the roadmap spike verdict: the CONFIG is statically gradeable (this file); the
 * server's runtime craftsmanship (tools/list descriptions) is Phase B (`--mcp-live`).
 * These checks run ONLY for `mcp` artifacts (whitelist scoping in checks/index.ts).
 */
import type { Check, CheckResult, Evidence } from "../types.js";
import { entryRel } from "./util.js";

interface McpServer {
  command?: string;
  args?: unknown[];
  env?: Record<string, unknown>;
  url?: string;
  [k: string]: unknown;
}

/** Parse `.mcp.json`, returning the servers map or an error string. */
export function parseMcpConfig(raw: string): { servers: Record<string, McpServer> } | { error: string } {
  try {
    const j = JSON.parse(raw) as Record<string, unknown>;
    const servers = j["mcpServers"];
    if (typeof servers !== "object" || servers === null || Array.isArray(servers)) {
      return { error: "no `mcpServers` object at the top level" };
    }
    return { servers: servers as Record<string, McpServer> };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

/** Best-effort 1-indexed line of the first occurrence of `needle` in `raw`. */
function lineOf(raw: string, needle: string): number {
  const i = raw.indexOf(needle);
  return i === -1 ? 1 : raw.slice(0, i).split("\n").length;
}

/** MCP-01 — the config parses and has the expected shape. */
export const mcp01: Check = {
  id: "MCP-01",
  category: "correctness",
  title: "Valid MCP config",
  weight: 1,
  appliesTo: ["mcp"],
  run(artifact): CheckResult {
    const file = entryRel(artifact);
    const base = { id: this.id, category: this.category, title: this.title, weight: this.weight };
    const parsed = parseMcpConfig(artifact.raw);
    if ("error" in parsed) {
      return {
        ...base,
        status: "fail",
        score: 0,
        evidence: [{ file, line: 1, message: `Config is not usable: ${parsed.error}`, verified: "parse/shape check failed" }],
        fix: 'Make it valid JSON with a top-level `"mcpServers": { "<name>": { … } }` object.',
      };
    }
    const n = Object.keys(parsed.servers).length;
    return {
      ...base,
      status: n > 0 ? "pass" : "warn",
      score: n > 0 ? 100 : 70,
      evidence: [{ file, line: 1, message: n > 0 ? `Valid config with ${n} server(s).` : "Valid but empty — no servers configured." }],
    };
  },
};

/** A pinned npm spec: `pkg@1.2.3`, `pkg@^1`, `@scope/pkg@latest` etc. (a version after the name). */
function isPinned(spec: string): boolean {
  return /^(@[^/]+\/)?[^@\s]+@.+$/.test(spec);
}

/** MCP-02 — npx-launched servers pin a version (supply-chain drift otherwise). */
export const mcp02: Check = {
  id: "MCP-02",
  category: "safety",
  title: "Server packages version-pinned",
  weight: 1,
  appliesTo: ["mcp"],
  run(artifact): CheckResult {
    const file = entryRel(artifact);
    const base = { id: this.id, category: this.category, title: this.title, weight: this.weight };
    const parsed = parseMcpConfig(artifact.raw);
    if ("error" in parsed) {
      return { ...base, status: "warn", score: 50, evidence: [{ file, line: 1, message: "Config unparseable — pinning not assessable (see MCP-01)." }] };
    }
    const evidence: Evidence[] = [];
    for (const [name, server] of Object.entries(parsed.servers)) {
      if (server.command !== "npx" && !(Array.isArray(server.args) && server.args.includes("npx"))) continue;
      const args = (server.args ?? []).map(String);
      const pkg = args.find((a) => !a.startsWith("-") && a !== "npx");
      if (pkg && !isPinned(pkg)) {
        evidence.push({
          file,
          line: lineOf(artifact.raw, pkg),
          snippet: `"${name}": npx ${args.join(" ")}`,
          claimed: `server "${name}" runs ${pkg}`,
          verified: "no version pin — every launch installs whatever is latest",
          message: "Unpinned npx server package: a compromised or breaking release ships straight into your session.",
        });
      }
    }
    if (evidence.length > 0) {
      return { ...base, status: "warn", score: 55, evidence, fix: "Pin versions: `npx -y some-server@1.2.3` (and review before bumping)." };
    }
    return { ...base, status: "pass", score: 100, evidence: [{ file, line: 1, message: "All npx-launched servers pin a version (or none use npx)." }] };
  },
};

/** MCP-03 — remote transports use TLS (localhost exempt). */
export const mcp03: Check = {
  id: "MCP-03",
  category: "safety",
  title: "Remote transports use TLS",
  weight: 1,
  appliesTo: ["mcp"],
  run(artifact): CheckResult {
    const file = entryRel(artifact);
    const base = { id: this.id, category: this.category, title: this.title, weight: this.weight };
    const parsed = parseMcpConfig(artifact.raw);
    if ("error" in parsed) {
      return { ...base, status: "warn", score: 50, evidence: [{ file, line: 1, message: "Config unparseable — transports not assessable (see MCP-01)." }] };
    }
    const evidence: Evidence[] = [];
    for (const [name, server] of Object.entries(parsed.servers)) {
      const url = typeof server.url === "string" ? server.url : undefined;
      if (url && /^http:\/\//i.test(url) && !/^http:\/\/(localhost|127\.0\.0\.1)([:/]|$)/i.test(url)) {
        evidence.push({
          file,
          line: lineOf(artifact.raw, url),
          snippet: url,
          claimed: `server "${name}" talks to a remote endpoint`,
          verified: "plain http:// — tool calls and results cross the network unencrypted",
          message: "Non-TLS remote MCP transport.",
        });
      }
    }
    if (evidence.length > 0) {
      return { ...base, status: "fail", score: 10, evidence, fix: "Use https:// for every remote server URL (localhost is exempt)." };
    }
    return { ...base, status: "pass", score: 100, evidence: [{ file, line: 1, message: "No plaintext remote transports." }] };
  },
};
