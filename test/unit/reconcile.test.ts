// Reconcile rules: never touch foreign entries, detect hand edits, prune what's no longer wanted.

import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import type { AppContext } from "../../src/app/AppContext.ts";
import type { Target } from "../../src/core/adapters/ToolAdapter.ts";
import { EntryHasher } from "../../src/core/store/EntryHasher.ts";
import { Reconciler } from "../../src/core/sync/Reconciler.ts";
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

await test("backups taken in the same millisecond never overwrite each other", () =>
  withSandbox((sb) => {
    const { ctx, file } = setup(sb);
    const versions = ["one", "two", "three", "four", "five"];
    for (const v of versions) {
      writeFileSync(file, v);
      ctx.backups.backup("t", file);
    }
    const listed = ctx.backups.list("t");
    assert.equal(new Set(listed.map((b) => b.id)).size, versions.length, "every backup has its own id");
    assert.deepEqual(
      listed.map((b) => readFileSync(b.backupPath, "utf8")),
      [...versions].reverse(),
      "newest first, each with its own content",
    );
    assert.match(listed[0]?.createdAt ?? "", /^\d{4}-\d{2}-\d{2}T[\d-]+Z$/, "createdAt has no sequence suffix");
  }));

await test("isEmptyJson: only empty objects along the root key count as empty", () => {
  assert.equal(Reconciler.isEmptyJson("{}", "servers"), true);
  assert.equal(Reconciler.isEmptyJson('{ "servers": {} }\n', "servers"), true);
  assert.equal(Reconciler.isEmptyJson('{ "amp.mcpServers": {} }', "amp\\.mcpServers"), true);
  assert.equal(Reconciler.isEmptyJson('{ "a": { "b": {} } }', "a.b"), true);
  assert.equal(Reconciler.isEmptyJson('{ "servers": {}, "inputs": [] }', "servers"), false, "other keys are content");
  assert.equal(Reconciler.isEmptyJson('{ "servers": { "x": {} } }', "servers"), false);
  assert.equal(Reconciler.isEmptyJson('{\n  // mine\n  "servers": {}\n}', "servers"), false, "comments are content");
  assert.equal(Reconciler.isEmptyJson("[]", "servers"), false);
});

await test("files wirebay created are deleted once empty; files it didn't create are kept", () =>
  withSandbox((sb) => {
    const ctx = sb.context();
    const created = path.join(sb.root, "created.json");
    const target = { tool, scope: "user" as const, file: created };
    const state: WirebayState = { version: 1, files: {} };
    ctx.reconciler.apply(ctx.reconciler.plan(target, state, { desired: { a: entry("a") } }), state);
    assert.equal(Object.values(state.files)[0]?.created, true, "creation is recorded");
    const plan = ctx.reconciler.plan(target, state, { desired: {} });
    assert.equal(plan.deleteFile, true);
    const result = ctx.reconciler.apply(plan, state);
    assert.equal(result?.deleted, true);
    assert.ok(!existsSync(created), "deleted");
    assert.ok(result.backup && existsSync(result.backup), "backed up first");
    assert.deepEqual(state.files, {}, "record dropped");

    // A file that existed before wirebay wrote to it is emptied but kept.
    const file = path.join(sb.root, "existing.json");
    writeFileSync(file, '{ "mcpServers": {} }\n');
    const t2 = { tool, scope: "user" as const, file };
    const s2: WirebayState = { version: 1, files: {} };
    ctx.reconciler.apply(ctx.reconciler.plan(t2, s2, { desired: { a: entry("a") } }), s2);
    const p2 = ctx.reconciler.plan(t2, s2, { desired: {} });
    assert.equal(p2.deleteFile, false);
    ctx.reconciler.apply(p2, s2);
    assert.ok(existsSync(file), "kept: wirebay didn't create it");

    // An opt-in location is deleted when empty even without the created flag (files from older versions).
    const legacy = path.join(sb.root, "legacy.json");
    writeFileSync(legacy, '{\n  "mcpServers": {\n    "a": { "command": "node", "args": ["a"] }\n  }\n}\n');
    const t3 = { tool, scope: "user" as const, file: legacy };
    const s3: WirebayState = { version: 1, files: {} };
    s3.files[`t|user|${legacy}`] = {
      tool: "t",
      scope: "user",
      path: legacy,
      entries: { a: new EntryHasher().hash(ctx.adapters.for(tool).read(t3).entries.a ?? {}) },
    };
    const p3 = ctx.reconciler.plan(t3, s3, { desired: {}, optIn: true });
    assert.equal(p3.deleteFile, true);
  }));

await test("an entry wirebay wrote in an older format is updated on sync, not treated as a hand edit", () =>
  withSandbox((sb) => {
    const { ctx, file, state, target } = setup(sb);
    ctx.reconciler.apply(ctx.reconciler.plan(target, state, { desired: { a: entry("a") } }), state);
    // The manifest's template changed (e.g. Cursor now needs "type": "stdio").
    const newer = { type: "stdio", ...entry("a") };
    const plan = ctx.reconciler.plan(target, state, { desired: { a: newer } });
    assert.deepEqual(plan.issues, []);
    assert.deepEqual(Object.keys(plan.changes.set), ["a"]);
    ctx.reconciler.apply(plan, state);
    assert.equal((readTool(file).mcpServers.a as unknown as { type: string }).type, "stdio");
  }));

await test("a write that doesn't read back correctly is rolled back", () =>
  withSandbox((sb) => {
    const { ctx, file, target } = setup(sb);
    const before = readFileSync(file, "utf8");
    const adapter = ctx.adapters.for(tool);
    const snapshot = adapter.read(target);
    assert.throws(() => adapter.commit(target, snapshot, { set: { a: entry("a") }, remove: [] }, "{ broken"), /didn't verify/);
    assert.equal(readFileSync(file, "utf8"), before, "the previous file is back");
  }));
