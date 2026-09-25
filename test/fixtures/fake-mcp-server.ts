// A minimal MCP server for tests. Answers initialize and tools/list over stdio.
// It reports which env keys it received through a tool name, so tests can check env filtering.
//   FAKE_MCP_EXIT_CODE=n  exit immediately with code n
//   FAKE_MCP_NOISE=1      print a non-JSON line on stdout first (a broken server)

import { createInterface } from "node:readline";

if (process.env.FAKE_MCP_EXIT_CODE) process.exit(Number(process.env.FAKE_MCP_EXIT_CODE));
if (process.env.FAKE_MCP_NOISE) process.stdout.write("hello from a noisy server\n");

const rl = createInterface({ input: process.stdin });
const send = (msg: unknown) => process.stdout.write(JSON.stringify(msg) + "\n");

rl.on("line", (line) => {
  const msg = JSON.parse(line) as { id?: number; method: string };
  if (msg.method === "initialize") {
    send({
      jsonrpc: "2.0",
      id: msg.id,
      result: { protocolVersion: "2025-06-18", capabilities: { tools: {} }, serverInfo: { name: "fake", version: "0.0.1" } },
    });
  } else if (msg.method === "tools/list") {
    const envKeys = Object.keys(process.env).filter((k) => k.startsWith("TEST_"));
    send({
      jsonrpc: "2.0",
      id: msg.id,
      result: { tools: [{ name: "echo", inputSchema: { type: "object" } }, ...envKeys.map((k) => ({ name: `env:${k}`, inputSchema: { type: "object" } }))] },
    });
  }
});
