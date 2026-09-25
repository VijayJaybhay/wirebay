// Reconcile rules: never touch foreign entries, detect hand edits, prune what's no longer wanted.

import assert from "node:assert/strict";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { applyPlan, planTarget } from "../../src/core/reconcile.ts";
import type { ToolManifest, WirebayState } from "../../src/core/types.ts";
import { sandbox } from "../helpers.ts";

const tool: ToolManifest = {
  id: "t",
  name: "Test tool",
  configs: { user: { path: "~/t.json" } },
  format: "json",
  rootKey: "mcpServers",
  entry: { stdio: { command: "{command}", args: "{args}" } },
};

function setup() {
  const sb = sandbox();
  const file = path.join(sb.home, "t.json");
  mkdirSync(sb.home, { recursive: true });
  writeFileSync(file, JSON.stringify({ mcpServers: { foreign: { command: "keep" } } }, null, 2));
  const state: WirebayState = { version: 1, files: {} };
  return { sb, file, state, target: { tool, scope: "user" as const, file } };
}

const entry = (x: string) => ({ command: "node", args: [x] });

test("adds, then reports unchanged, then prunes", () => {
  const { sb, file, state, target } = setup();
  try {
    let plan = planTarget(target, state, { desired: { a: entry("a") } });
    assert.deepEqual(Object.keys(plan.changes.set), ["a"]);
    applyPlan(plan, state);
    plan = planTarget(target, state, { desired: { a: entry("a") } });
    assert.deepEqual(plan.unchanged, ["a"]);
    assert.equal(Object.keys(plan.changes.set).length, 0);
    plan = planTarget(target, state, { desired: {} });
    assert.deepEqual(plan.changes.remove, ["a"]);
    applyPlan(plan, state);
    const json = JSON.parse(readFileSync(file, "utf8"));
    assert.deepEqual(Object.keys(json.mcpServers), ["foreign"]);
    assert.deepEqual(state.files, {});
  } finally {
    sb.cleanup();
  }
});

test("a same-named entry not created by wirebay is a conflict unless --force", () => {
  const { sb, state, target } = setup();
  try {
    const plan = planTarget(target, state, { desired: { foreign: entry("x") } });
    assert.equal(plan.issues[0]?.kind, "conflict");
    assert.equal(Object.keys(plan.changes.set).length, 0);
    const forced = planTarget(target, state, { desired: { foreign: entry("x") }, force: true });
    assert.deepEqual(Object.keys(forced.changes.set), ["foreign"]);
  } finally {
    sb.cleanup();
  }
});

test("hand-edited managed entries are drift, not overwritten or removed", () => {
  const { sb, file, state, target } = setup();
  try {
    applyPlan(planTarget(target, state, { desired: { a: entry("a") } }), state);
    const json = JSON.parse(readFileSync(file, "utf8"));
    json.mcpServers.a.args.push("--my-flag");
    writeFileSync(file, JSON.stringify(json, null, 2));
    const update = planTarget(target, state, { desired: { a: entry("a2") } });
    assert.equal(update.issues[0]?.kind, "drift");
    const removal = planTarget(target, state, { desired: {} });
    assert.equal(removal.issues[0]?.kind, "drift");
    assert.equal(removal.changes.remove.length, 0);
    assert.deepEqual(planTarget(target, state, { desired: {}, force: true }).changes.remove, ["a"]);
  } finally {
    sb.cleanup();
  }
});

test("scopeNames limits which managed entries are considered", () => {
  const { sb, state, target } = setup();
  try {
    applyPlan(planTarget(target, state, { desired: { a: entry("a"), b: entry("b") } }), state);
    const plan = planTarget(target, state, { desired: {}, scopeNames: new Set(["a"]) });
    assert.deepEqual(plan.changes.remove, ["a"]);
  } finally {
    sb.cleanup();
  }
});
