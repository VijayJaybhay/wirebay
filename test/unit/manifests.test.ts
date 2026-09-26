// Cross-tool manifest checks: two tools must never write the same file with different structures
// unless the clash is declared (an incompatible `alsoReads`, which makes the location opt-in).

import assert from "node:assert/strict";
import { test } from "node:test";
import { ConfigReadGraph } from "../../src/core/tools/ConfigReadGraph.ts";
import { Tool } from "../../src/core/tools/Tool.ts";
import type { ConfigRead, ScopeName } from "../../src/core/types.ts";
import { withSandbox } from "../helpers.ts";

const OSES = ["win32", "darwin", "linux"] as const;

/** The raw path template of a tool's scope on one OS (before expansion), normalised for comparison. */
function template(tool: Tool, scope: ScopeName, os: (typeof OSES)[number]): string | undefined {
  const location = tool.manifest.configs[scope];
  if (!location) return undefined;
  const raw = typeof location.path === "string" ? location.path : location.path[os];
  return raw?.replaceAll("\\", "/").toLowerCase();
}

/** Undeclared same-path clashes between tools. */
function clashes(tools: Tool[]): string[] {
  const graph = new ConfigReadGraph(tools);
  const problems: string[] = [];
  for (const os of OSES) {
    const byPath = new Map<string, { tool: Tool; scope: ScopeName }[]>();
    for (const tool of tools)
      for (const scope of tool.scopes) {
        const p = template(tool, scope, os);
        if (p) byPath.set(p, [...(byPath.get(p) ?? []), { tool, scope }]);
      }
    for (const [p, owners] of byPath)
      for (const a of owners)
        for (const b of owners) {
          if (a.tool.id >= b.tool.id) continue;
          const sameShape = a.tool.rootKey === b.tool.rootKey && a.tool.format === b.tool.format;
          const declared = graph.isOptIn(a.tool.id, a.scope) || graph.isOptIn(b.tool.id, b.scope);
          if (!sameShape && !declared) problems.push(`${os}: ${p} is written by ${a.tool.id} and ${b.tool.id} with different structures`);
        }
  }
  return problems;
}

function fake(id: string, rootKey: string, alsoReads: ConfigRead[] = []): Tool {
  return new Tool({
    id,
    name: id,
    configs: { user: { path: "~/.shared.json" } },
    format: "json",
    rootKey,
    entry: { stdio: {} },
    alsoReads,
  });
}

await test("the real manifests have no undeclared same-path clash", () =>
  withSandbox((sb) => {
    assert.deepEqual(
      clashes(
        sb
          .context()
          .tools.all()
          .filter((t) => t.manifest.source === "package"),
      ),
      [],
    );
  }));

await test("an undeclared clash is caught; declaring it as an incompatible read resolves it", () => {
  assert.equal(clashes([fake("a", "servers"), fake("b", "mcpServers")]).length, 3); // one per OS
  const read: ConfigRead = { tool: "a", scope: "user", when: "always", compatible: false, note: "n", source: "https://x" };
  assert.deepEqual(clashes([fake("a", "servers"), fake("b", "mcpServers", [read])]), []);
});
