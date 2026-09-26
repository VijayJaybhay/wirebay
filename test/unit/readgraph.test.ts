// ConfigReadGraph: which tools read which other tools' MCP config files.

import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { ServerMapOps } from "../../src/core/store/ServerMapOps.ts";
import { ConfigReadGraph } from "../../src/core/tools/ConfigReadGraph.ts";
import { Tool } from "../../src/core/tools/Tool.ts";
import type { ConfigRead, ToolManifest } from "../../src/core/types.ts";
import { withSandbox } from "../helpers.ts";

/** Visual Studio (and its ~/.mcp.json) exists only on Windows. */
const windowsOnly = { skip: process.platform === "win32" ? false : "Visual Studio is Windows-only" };

function tool(id: string, alsoReads: ConfigRead[] = []): Tool {
  const manifest: ToolManifest = {
    id,
    name: id.toUpperCase(),
    configs: { user: { path: `~/.${id}.json` }, project: { path: `{cwd}/.${id}.json` } },
    format: "json",
    rootKey: "mcpServers",
    entry: { stdio: { command: "{command}" } },
    alsoReads,
  };
  return new Tool(manifest);
}

const read = (over: Partial<ConfigRead> & Pick<ConfigRead, "tool" | "scope">): ConfigRead => ({
  when: "always",
  compatible: true,
  note: "reads it",
  source: "https://example.com/docs",
  ...over,
});

const graph = new ConfigReadGraph([
  tool("a"),
  tool("b", [read({ tool: "a", scope: "project" }), read({ tool: "a", scope: "user", when: "setting", setting: "x.discovery" })]),
  tool("c", [read({ tool: "a", scope: "user", compatible: false, note: "expects another key" })]),
]);

await test("sourcesOf lists what a tool reads besides its own files", () => {
  assert.deepEqual(
    graph.sourcesOf("b").map((r) => `${r.tool}:${r.scope}`),
    ["a:project", "a:user"],
  );
  assert.deepEqual(graph.sourcesOf("a"), []);
  assert.deepEqual(graph.sourcesOf("unknown"), []);
});

await test("readersOf is the reverse edge, per scope", () => {
  assert.deepEqual(
    graph.readersOf("a", "user").map((r) => r.reader.id),
    ["b", "c"],
  );
  assert.deepEqual(
    graph.readersOf("a", "project").map((r) => r.reader.id),
    ["b"],
  );
  assert.deepEqual(graph.readersOf("b", "user"), []);
});

await test("an incompatible reader makes that location opt-in, and only that one", () => {
  assert.deepEqual(
    graph.conflictsFor("a", "user").map((r) => r.reader.id),
    ["c"],
  );
  assert.equal(graph.isOptIn("a", "user"), true);
  assert.equal(graph.isOptIn("a", "project"), false);
  assert.equal(graph.isOptIn("b", "user"), false);
});

await test("indirectServers: servers a tool may also load through another tool's file", () => {
  const desired = new ServerMapOps({ github: { tools: ["a", "b"] }, netlify: { tools: ["a"] }, other: { tools: ["c"] } });
  assert.deepEqual(
    graph.indirectServers("b", "project", desired).map((s) => `${s.server} via ${s.via}`),
    ["github via a", "netlify via a"],
  );
  // Incompatible reads carry no servers (the reader can't parse the file).
  assert.deepEqual(graph.indirectServers("c", "user", desired), []);
});

await test("the real manifests: Visual Studio's global file is opt-in because of Claude Code", () =>
  withSandbox((sb) => {
    const ctx = sb.context();
    assert.equal(ctx.readGraph.isOptIn("visual-studio", "user"), true);
    assert.equal(ctx.readGraph.isOptIn("visual-studio", "project"), false);
    assert.equal(ctx.readGraph.isOptIn("claude-code", "project"), false);
    assert.ok(
      ctx.readGraph
        .readersOf("claude-code", "project")
        .map((r) => r.reader.id)
        .includes("copilot-cli"),
    );
  }));

await test("a config file alone doesn't make a tool with detect.configFile=false look installed", windowsOnly, () =>
  withSandbox((sb) => {
    writeFileSync(path.join(sb.home, ".mcp.json"), '{ "servers": {} }'); // e.g. written by wirebay itself
    const ctx = sb.context();
    const vs = ctx.tools.get("visual-studio");
    assert.equal(vs.isInstalled(ctx.resolver, ctx.paths), false);
    mkdirSync(path.join(sb.home, "AppData", "Local", "Microsoft", "VisualStudio"), { recursive: true });
    assert.equal(vs.isInstalled(ctx.resolver, ctx.paths), true, "the real install folder still counts");
  }),
);
