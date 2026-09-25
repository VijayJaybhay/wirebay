// Reconcile: compare the desired entries for a tool file with what is actually in it and
// with what wirebay wrote last time (state.json), then plan and apply the changes.
//   - entries wirebay never wrote are never touched (a name clash is a conflict)
//   - managed entries edited by hand are "drift" and need --force
//   - managed entries no longer wanted are pruned

import { createTwoFilesPatch } from "diff";
import { adapterFor } from "../adapters/index.ts";
import type { Changes, Snapshot, Target } from "../adapters/types.ts";
import { hashEntry, sameEntry, stateKey } from "./store.ts";
import type { Entry, WirebayState } from "./types.ts";

export interface Issue {
  name: string;
  kind: "conflict" | "drift";
  message: string;
}

export interface TargetPlan {
  target: Target;
  snapshot: Snapshot;
  changes: Changes;
  unchanged: string[];
  issues: Issue[];
  /** New file text (equal to the old text when nothing changes). */
  after: string;
  /** Hashes to record for this file after applying (actual and desired). */
  next: { entries: Record<string, string>; desired: Record<string, string> };
}

export interface PlanOptions {
  /** Desired entries for the servers in scope of this operation. */
  desired: Record<string, Entry>;
  /** Server names this operation is about. Managed entries outside this set are left alone. */
  scopeNames?: Set<string>;
  force?: boolean;
}

export function planTarget(target: Target, state: WirebayState, opts: PlanOptions): TargetPlan {
  const adapter = adapterFor(target.tool);
  const snapshot = adapter.read(target);
  const record = state.files[stateKey(target.tool.id, target.scope, target.file)];
  const recorded = { ...(record?.entries ?? {}) };
  const recordedDesired = { ...(record?.desired ?? record?.entries ?? {}) };
  const inScope = (name: string) => !opts.scopeNames || opts.scopeNames.has(name);

  const changes: Changes = { set: {}, remove: [] };
  const unchanged: string[] = [];
  const issues: Issue[] = [];
  const next = { entries: { ...recorded }, desired: { ...recordedDesired } };

  for (const [name, entry] of Object.entries(opts.desired)) {
    if (!inScope(name)) continue;
    const current = snapshot.entries[name];
    const managed = name in recorded;
    const wantHash = hashEntry(entry);
    if (snapshot.locked.has(name)) {
      issues.push({
        name,
        kind: "conflict",
        message: `"${name}" is already defined in ${target.file} outside the wirebay block. Remove it there (or rename the server) and sync again.`,
      });
      continue;
    }
    const untouchedSinceSync = current !== undefined && managed && hashEntry(current) === recorded[name];
    if (current !== undefined && (sameEntry(current, entry) || (untouchedSinceSync && recordedDesired[name] === wantHash))) {
      unchanged.push(name);
      next.entries[name] = hashEntry(current);
      next.desired[name] = wantHash;
      continue;
    }
    if (current !== undefined && !managed && !opts.force) {
      issues.push({
        name,
        kind: "conflict",
        message: `"${name}" already exists in ${target.file} and was not created by wirebay. Use --force to replace it.`,
      });
      continue;
    }
    if (current !== undefined && managed && !untouchedSinceSync && !opts.force) {
      issues.push({
        name,
        kind: "drift",
        message: `"${name}" in ${target.file} was edited by hand since the last sync. Use --force to overwrite it.`,
      });
      continue;
    }
    changes.set[name] = entry;
    next.entries[name] = wantHash;
    next.desired[name] = wantHash;
  }

  for (const name of Object.keys(recorded)) {
    if (!inScope(name) || name in opts.desired) continue;
    const current = snapshot.entries[name];
    delete next.entries[name];
    delete next.desired[name];
    if (current === undefined) continue;
    if (hashEntry(current) !== recorded[name] && !opts.force) {
      next.entries[name] = recorded[name]!;
      next.desired[name] = recordedDesired[name] ?? recorded[name]!;
      issues.push({
        name,
        kind: "drift",
        message: `"${name}" in ${target.file} was edited by hand, so wirebay will not remove it. Use --force to remove it anyway.`,
      });
      continue;
    }
    changes.remove.push(name);
  }

  const after = hasChangesIn(changes) ? adapter.render(target, snapshot, changes) : snapshot.text;
  return { target, snapshot, changes, unchanged, issues, after, next };
}

function hasChangesIn(changes: Changes): boolean {
  return Object.keys(changes.set).length > 0 || changes.remove.length > 0;
}

export function hasChanges(plan: TargetPlan): boolean {
  return hasChangesIn(plan.changes);
}

export function diffPlan(plan: TargetPlan): string {
  return createTwoFilesPatch(plan.target.file, plan.target.file, plan.snapshot.text, plan.after, "current", "after sync", { context: 3 });
}

/** Apply a plan and record the result in state (the caller saves state). */
export function applyPlan(plan: TargetPlan, state: WirebayState): { via: "file" | "cli"; backup?: string } | undefined {
  const { tool, scope, file } = plan.target;
  const key = stateKey(tool.id, scope, file);
  let result: { via: "file" | "cli"; backup?: string } | undefined;
  if (hasChanges(plan)) {
    const adapter = adapterFor(tool);
    result = adapter.commit(plan.target, plan.snapshot, plan.changes, plan.after);
    if (result.via === "cli") {
      // The tool's CLI may normalise entries; record what it actually wrote.
      const written = adapter.read(plan.target).entries;
      for (const name of Object.keys(plan.changes.set)) {
        if (written[name] !== undefined) plan.next.entries[name] = hashEntry(written[name]);
      }
    }
  }
  if (Object.keys(plan.next.entries).length) {
    state.files[key] = { tool: tool.id, scope, path: file, entries: plan.next.entries, desired: plan.next.desired };
  } else {
    delete state.files[key];
  }
  return result;
}
