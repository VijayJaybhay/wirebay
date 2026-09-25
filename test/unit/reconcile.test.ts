// Reconcile rules: never touch foreign entries, detect hand edits, prune what's no longer wanted.

import assert from "node:assert/strict";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import type { AppContext } from "../../src/app/AppContext.ts";
import type { Target } from "../../src/core/adapters/ToolAdapter.ts";
import { Tool } from "../../src/core/tools/Tool.ts";
import type { WirebayState } from "../../src/core/types.ts";
import { type Sandbox, withSandbox } from "../helpers.ts";

const tool = new Tool({
  id: "t",
  name: "Test tool",
  configs: { user: { path: "~/t.json" } },
  format: "json",
  rootKey: "mcpServers",
  entry: { stdio: { command: "{command}", args: "{args}" } },
});
const entry = (x: string): { command: string; args: string[] } => ({ command: "node", args: [x] });

interface Setup {
  ctx: AppContext;
  file: string;
  state: WirebayState;
  target: Target;
}

/** Parse a tool file written by the test. */
function readTool(file: string): { mcpServers: Record<string, { command: string; args: string[] }> } {
  return JSON.parse(readFileSync(file, "utf8")) as { mcpServers: Record<string, { command: string; args: string[] }> };
}

function setup(sb: Sandbox): Setup {
  const file = path.join(sb.home, "t.json");
  writeFileSync(file, JSON.stringify({ mcpServers: { foreign: { command: "keep" } } }, null, 2));
  const state: WirebayState = { version: 1, files: {} };
  const target: Target = { tool, scope: "user", file };
  return { ctx: sb.context(), file, state, target };
}

await test("adds, then reports unchanged, then prunes", () =>
  withSandbox((sb) => {
    const { ctx, file, state, target } = setup(sb);
    const r = ctx.reconciler;
    let plan = r.plan(target, state, { desired: { a: entry("a") } });
    assert.deepEqual(Object.keys(plan.changes.set), ["a"]);
    r.apply(plan, state);
    plan = r.plan(target, state, { desired: { a: entry("a") } });
    assert.deepEqual(plan.unchanged, ["a"]);
    plan = r.plan(target, state, { desired: {} });
    assert.deepEqual(plan.changes.remove, ["a"]);
    r.apply(plan, state);
    assert.deepEqual(Object.keys(readTool(file).mcpServers), ["foreign"]);
    assert.deepEqual(state.files, {});
  }));

await test("a same-named entry not created by wirebay is a conflict unless --force", () =>
  withSandbox((sb) => {
    const { ctx, state, target } = setup(sb);
    const plan = ctx.reconciler.plan(target, state, { desired: { foreign: entry("x") } });
    assert.equal(plan.issues[0]?.kind, "conflict");
    assert.equal(Object.keys(plan.changes.set).length, 0);
    assert.deepEqual(Object.keys(ctx.reconciler.plan(target, state, { desired: { foreign: entry("x") }, force: true }).changes.set), [
      "foreign",
    ]);
  }));

await test("hand-edited managed entries are drift, not overwritten or removed", () =>
  withSandbox((sb) => {
    const { ctx, file, state, target } = setup(sb);
    const r = ctx.reconciler;
    r.apply(r.plan(target, state, { desired: { a: entry("a") } }), state);
    const json = readTool(file);
    json.mcpServers.a?.args.push("--my-flag");
    writeFileSync(file, JSON.stringify(json, null, 2));
    assert.equal(r.plan(target, state, { desired: { a: entry("a2") } }).issues[0]?.kind, "drift");
    const removal = r.plan(target, state, { desired: {} });
    assert.equal(removal.issues[0]?.kind, "drift");
    assert.equal(removal.changes.remove.length, 0);
    assert.deepEqual(r.plan(target, state, { desired: {}, force: true }).changes.remove, ["a"]);
  }));

await test("scopeNames limits which managed entries are considered", () =>
  withSandbox((sb) => {
    const { ctx, state, target } = setup(sb);
    const r = ctx.reconciler;
    r.apply(r.plan(target, state, { desired: { a: entry("a"), b: entry("b") } }), state);
    assert.deepEqual(r.plan(target, state, { desired: {}, scopeNames: new Set(["a"]) }).changes.remove, ["a"]);
  }));

await test("stray files in tools folders are ignored (ENOTDIR on Linux/macOS)", () =>
  withSandbox((sb) => {
    const toolsDir = path.join(sb.wirebayHome, "tools");
    mkdirSync(toolsDir, { recursive: true });
    writeFileSync(path.join(toolsDir, "NOTES.md"), "not a tool");
    const ctx = sb.context();
    assert.ok(ctx.tools.all().length > 20);
    assert.equal(ctx.writer.read(path.join(toolsDir, "NOTES.md", "tool.json")), undefined);
  }));

await test("writes are backed up and restorable", () =>
  withSandbox((sb) => {
    const { ctx, file, state, target } = setup(sb);
    const before = readFileSync(file, "utf8");
    ctx.reconciler.apply(ctx.reconciler.plan(target, state, { desired: { a: entry("a") } }), state);
    const [latest] = ctx.backups.list("t");
    assert.ok(latest, "a backup was taken");
    assert.equal(latest.originalPath, path.resolve(file));
    ctx.backups.restore(latest);
    assert.equal(readFileSync(file, "utf8"), before);
  }));
