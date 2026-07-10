#!/usr/bin/env node
// A minimal MCP stdio server for testing --mcp-live: answers initialize + tools/list over
// newline-delimited JSON-RPC. Tool quality is deliberately mixed to exercise MCPT-02/03.
import { createInterface } from "node:readline";

const rl = createInterface({ input: process.stdin });
const send = (o) => process.stdout.write(`${JSON.stringify(o)}\n`);

rl.on("line", (line) => {
  let msg;
  try {
    msg = JSON.parse(line);
  } catch {
    return;
  }
  if (msg.method === "initialize") {
    send({
      jsonrpc: "2.0",
      id: msg.id,
      result: {
        protocolVersion: "2025-06-18",
        capabilities: { tools: {} },
        serverInfo: { name: "fake-mcp", version: "0.0.1" },
      },
    });
  } else if (msg.method === "tools/list") {
    send({
      jsonrpc: "2.0",
      id: msg.id,
      result: {
        tools: [
          {
            name: "search_docs",
            description:
              "Search the documentation corpus for pages matching a query and return ranked excerpts with links.",
            inputSchema: {
              type: "object",
              properties: { query: { type: "string", description: "Free-text search query." } },
            },
          },
          {
            name: "zap", // deliberately bad: title-length description, undocumented param
            description: "Zaps.",
            inputSchema: { type: "object", properties: { target: { type: "string" } } },
          },
        ],
      },
    });
  }
});
