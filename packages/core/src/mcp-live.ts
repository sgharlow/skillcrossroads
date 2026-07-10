/**
 * MCP Phase B — live server introspection (`--mcp-live`).
 *
 * Spawns each STDIO server from a `.mcp.json`, performs the MCP handshake, and captures
 * `tools/list`. CONSENT MODEL: this runs commands from the user's own config on the user's own
 * machine, behind an explicit CLI flag — it must NEVER be reachable from the hosted web app
 * (spawning attacker-supplied commands server-side is remote code execution by design).
 *
 * Split for testability: `introspectMcpConfig` does the I/O; `gradeMcpLive` is a pure function
 * over the captured data (fully unit-testable; the I/O path is proven against a fake stdio
 * server fixture in CI).
 */
import { spawn } from "node:child_process";
import { parseMcpConfig } from "./checks/mcp-config.js";
import type { Category, CheckResult, Evidence } from "./types.js";

export interface McpTool {
  name: string;
  description?: string;
  inputSchema?: { properties?: Record<string, { description?: string }> };
}

export interface McpServerIntrospection {
  server: string;
  /** Tools reported by tools/list, or undefined when the server could not be introspected. */
  tools?: McpTool[];
  /** Why introspection failed (spawn error, handshake timeout, protocol error). */
  error?: string;
  /** True when the server was skipped by design (url/http transport — stdio only in Phase B). */
  skipped?: boolean;
}

const PROTOCOL_VERSION = "2025-06-18";

/** One JSON-RPC exchange over a child's stdio, newline-delimited. */
function rpcClient(child: ReturnType<typeof spawn>): {
  request: (method: string, params: object, timeoutMs: number) => Promise<unknown>;
  notify: (method: string) => void;
} {
  let nextId = 1;
  const pending = new Map<number, (v: { result?: unknown; error?: { message?: string } }) => void>();
  let buffer = "";
  child.stdout?.on("data", (chunk: Buffer) => {
    buffer += chunk.toString("utf8");
    let nl: number;
    while ((nl = buffer.indexOf("\n")) !== -1) {
      const line = buffer.slice(0, nl).trim();
      buffer = buffer.slice(nl + 1);
      if (!line) continue;
      try {
        const msg = JSON.parse(line) as { id?: number; result?: unknown; error?: { message?: string } };
        if (typeof msg.id === "number" && pending.has(msg.id)) {
          pending.get(msg.id)!(msg);
          pending.delete(msg.id);
        }
      } catch {
        /* non-JSON stdout noise — ignore */
      }
    }
  });
  return {
    request: (method, params, timeoutMs) =>
      new Promise((resolve, reject) => {
        const id = nextId++;
        const timer = setTimeout(() => {
          pending.delete(id);
          reject(new Error(`${method} timed out after ${timeoutMs}ms`));
        }, timeoutMs);
        pending.set(id, (msg) => {
          clearTimeout(timer);
          if (msg.error) reject(new Error(msg.error.message ?? "server returned an error"));
          else resolve(msg.result);
        });
        child.stdin?.write(`${JSON.stringify({ jsonrpc: "2.0", id, method, params })}\n`);
      }),
    notify: (method) => {
      child.stdin?.write(`${JSON.stringify({ jsonrpc: "2.0", method })}\n`);
    },
  };
}

/** Introspect one stdio server: spawn → initialize → tools/list → kill. */
async function introspectServer(
  name: string,
  command: string,
  args: string[],
  env: Record<string, string>,
  timeoutMs: number,
): Promise<McpServerIntrospection> {
  let child: ReturnType<typeof spawn>;
  try {
    child = spawn(command, args, {
      stdio: ["pipe", "pipe", "ignore"],
      env: { ...process.env, ...env },
      shell: process.platform === "win32", // npx etc. are .cmd shims on Windows
    });
  } catch (err) {
    return { server: name, error: err instanceof Error ? err.message : String(err) };
  }
  try {
    const spawnError = new Promise<never>((_, reject) => {
      child.on("error", (e) => reject(new Error(`spawn failed: ${e.message}`)));
      child.on("exit", (code) => reject(new Error(`server exited early (code ${code})`)));
    });
    const rpc = rpcClient(child);
    await Promise.race([
      rpc.request(
        "initialize",
        {
          protocolVersion: PROTOCOL_VERSION,
          capabilities: {},
          clientInfo: { name: "skillcrossroads", version: "mcp-live" },
        },
        timeoutMs,
      ),
      spawnError,
    ]);
    rpc.notify("notifications/initialized");
    const result = (await Promise.race([rpc.request("tools/list", {}, timeoutMs), spawnError])) as {
      tools?: McpTool[];
    };
    return { server: name, tools: result.tools ?? [] };
  } catch (err) {
    return { server: name, error: err instanceof Error ? err.message : String(err) };
  } finally {
    child.kill();
  }
}

/** Introspect every stdio server in a `.mcp.json` (url transports are skipped by design). */
export async function introspectMcpConfig(
  raw: string,
  opts: { timeoutMs?: number } = {},
): Promise<McpServerIntrospection[]> {
  const timeoutMs = opts.timeoutMs ?? 10_000;
  const parsed = parseMcpConfig(raw);
  if ("error" in parsed) return [];
  const out: McpServerIntrospection[] = [];
  for (const [name, server] of Object.entries(parsed.servers)) {
    if (typeof server.url === "string") {
      out.push({ server: name, skipped: true });
      continue;
    }
    if (typeof server.command !== "string") {
      out.push({ server: name, error: "no command configured" });
      continue;
    }
    const env: Record<string, string> = {};
    for (const [k, v] of Object.entries(server.env ?? {})) env[k] = String(v);
    out.push(await introspectServer(name, server.command, (server.args ?? []).map(String), env, timeoutMs));
  }
  return out;
}

const mk = (
  id: string,
  category: Category,
  title: string,
  status: "pass" | "warn" | "fail",
  score: number,
  evidence: Evidence[],
  fix?: string,
): CheckResult => ({ id, category, title, weight: 1, status, score, evidence, ...(fix ? { fix } : {}) });

/**
 * Pure grading over introspection data — appended to the config's Phase-A scorecard results.
 * MCPT-01: servers answer tools/list · MCPT-02: tool descriptions anchor invocation ·
 * MCPT-03: input parameters are documented.
 */
export function gradeMcpLive(file: string, servers: readonly McpServerIntrospection[]): CheckResult[] {
  const live = servers.filter((s) => !s.skipped);
  if (live.length === 0) return [];

  // MCPT-01 — reachability
  const dead = live.filter((s) => s.error);
  const r1 =
    dead.length === 0
      ? mk("MCPT-01", "correctness", "Servers answer tools/list", "pass", 100, [
          { file, line: 1, message: `${live.length} stdio server(s) responded with their tool list.` },
        ])
      : mk(
          "MCPT-01",
          "correctness",
          "Servers answer tools/list",
          "fail",
          Math.round(100 * (1 - dead.length / live.length)),
          dead.map((s) => ({
            file,
            line: 1,
            claimed: `server "${s.server}" is usable`,
            verified: s.error as string,
            message: `"${s.server}" could not be introspected.`,
          })),
          "Fix the server command/launch so it completes the MCP handshake and answers tools/list.",
        );

  const tools = live.flatMap((s) => (s.tools ?? []).map((t) => ({ server: s.server, tool: t })));
  if (tools.length === 0) return [r1];

  // MCPT-02 — description quality (the "will the model pick this tool?" floor)
  const thin = tools.filter((t) => !t.tool.description || t.tool.description.trim().length < 40);
  const score2 = Math.round(100 * (1 - thin.length / tools.length));
  const r2 =
    thin.length === 0
      ? mk("MCPT-02", "triggering", "Tool descriptions anchor invocation", "pass", 100, [
          { file, line: 1, message: `All ${tools.length} tool description(s) are substantive.` },
        ])
      : mk(
          "MCPT-02",
          "triggering",
          "Tool descriptions anchor invocation",
          thin.length === tools.length ? "fail" : "warn",
          score2,
          thin.slice(0, 5).map(({ server, tool }) => ({
            file,
            line: 1,
            snippet: tool.description?.slice(0, 60) || "(none)",
            claimed: `tool "${server}/${tool.name}" is discoverable`,
            verified: tool.description ? `${tool.description.trim().length} chars — title-length` : "no description",
            message: "The model has almost nothing to match this tool against.",
          })),
          "Give every tool a description stating what it does and when the model should call it.",
        );

  // MCPT-03 — parameter documentation
  const params = tools.flatMap(({ server, tool }) =>
    Object.entries(tool.inputSchema?.properties ?? {}).map(([p, def]) => ({ server, tool: tool.name, p, def })),
  );
  const results = [r1, r2];
  if (params.length > 0) {
    const undocumented = params.filter((x) => !x.def?.description?.trim());
    const score3 = Math.round(100 * (1 - undocumented.length / params.length));
    results.push(
      undocumented.length === 0
        ? mk("MCPT-03", "clarity", "Tool parameters documented", "pass", 100, [
            { file, line: 1, message: `All ${params.length} input parameter(s) carry descriptions.` },
          ])
        : mk(
            "MCPT-03",
            "clarity",
            "Tool parameters documented",
            score3 < 50 ? "fail" : "warn",
            score3,
            undocumented.slice(0, 5).map((x) => ({
              file,
              line: 1,
              claimed: `"${x.server}/${x.tool}" param "${x.p}" is usable`,
              verified: "no description in inputSchema",
              message: "The model must guess what this parameter means.",
            })),
            "Describe every inputSchema property — parameter docs are what the model reads.",
          ),
    );
  }
  return results;
}
