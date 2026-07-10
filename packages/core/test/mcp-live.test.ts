import { describe, it, expect } from "vitest";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { introspectMcpConfig, gradeMcpLive, type McpServerIntrospection } from "../src/mcp-live.js";

const here = dirname(fileURLToPath(import.meta.url));
const FAKE_SERVER = join(here, "fixtures", "fake-mcp-server.mjs");

describe("gradeMcpLive (pure grading over introspection data)", () => {
  it("returns nothing when every server was skipped (url transports)", () => {
    expect(gradeMcpLive(".mcp.json", [{ server: "remote", skipped: true }])).toEqual([]);
  });

  it("fails MCPT-01 with per-server evidence when servers can't be introspected", () => {
    const servers: McpServerIntrospection[] = [
      { server: "dead", error: "spawn failed: ENOENT" },
      { server: "alive", tools: [] },
    ];
    const r1 = gradeMcpLive(".mcp.json", servers).find((r) => r.id === "MCPT-01")!;
    expect(r1.status).toBe("fail");
    expect(r1.evidence[0]?.verified).toContain("ENOENT");
  });

  it("warns MCPT-02 on title-length tool descriptions and MCPT-03 on undocumented params", () => {
    const servers: McpServerIntrospection[] = [
      {
        server: "s",
        tools: [
          {
            name: "good",
            description: "Search the docs corpus for pages matching a query and return ranked excerpts.",
            inputSchema: { properties: { q: { description: "Query text." } } },
          },
          { name: "zap", description: "Zaps.", inputSchema: { properties: { target: {} } } },
        ],
      },
    ];
    const results = gradeMcpLive(".mcp.json", servers);
    const t2 = results.find((r) => r.id === "MCPT-02")!;
    const t3 = results.find((r) => r.id === "MCPT-03")!;
    expect(t2.status).toBe("warn");
    expect(t2.evidence[0]?.claimed).toContain("s/zap");
    expect(t3.status).toBe("warn");
    expect(t3.evidence[0]?.claimed).toContain('param "target"');
  });

  it("passes all three when tools and params are fully documented", () => {
    const servers: McpServerIntrospection[] = [
      {
        server: "s",
        tools: [
          {
            name: "good",
            description: "Search the documentation corpus for pages matching a query, ranked by relevance.",
            inputSchema: { properties: { q: { description: "Free-text query." } } },
          },
        ],
      },
    ];
    for (const r of gradeMcpLive(".mcp.json", servers)) expect(r.status).toBe("pass");
  });
});

describe("introspectMcpConfig — live against a real stdio server (the fake fixture)", () => {
  it("spawns, handshakes, and captures tools/list end to end", async () => {
    const config = JSON.stringify({
      mcpServers: {
        fake: { command: "node", args: [FAKE_SERVER] },
        remote: { url: "https://mcp.example.com/sse" },
      },
    });
    const servers = await introspectMcpConfig(config, { timeoutMs: 8000 });
    const fake = servers.find((s) => s.server === "fake")!;
    const remote = servers.find((s) => s.server === "remote")!;
    expect(remote.skipped).toBe(true);
    expect(fake.error).toBeUndefined();
    expect(fake.tools?.map((t) => t.name).sort()).toEqual(["search_docs", "zap"]);
    // and the pipeline grades what came back: mixed quality → warn on MCPT-02
    const graded = gradeMcpLive(".mcp.json", servers);
    expect(graded.find((r) => r.id === "MCPT-01")?.status).toBe("pass");
    expect(graded.find((r) => r.id === "MCPT-02")?.status).toBe("warn");
  }, 20_000);

  it("reports an error (not a hang) for a server that never speaks MCP", async () => {
    const config = JSON.stringify({
      mcpServers: { silent: { command: "node", args: ["-e", "setTimeout(()=>{},30000)"] } },
    });
    const t0 = Date.now();
    const servers = await introspectMcpConfig(config, { timeoutMs: 1500 });
    // The property: introspection SURFACES an error and returns promptly — whether the child
    // hung (timeout) or died on argv quoting (exited early) varies by platform shell.
    expect(servers[0]?.error).toMatch(/timed out|exited early|spawn failed/);
    expect(Date.now() - t0).toBeLessThan(10_000);
  }, 20_000);
});
