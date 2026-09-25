/**
 * Plans and applies the changes for one tool file by comparing three things:
 * the desired entries, what is actually in the file, and what wirebay wrote last time.
 * @module
 */

import { createTwoFilesPatch } from "diff";
import type { AdapterFactory } from "../adapters/AdapterFactory.ts";
import type { CommitResult, Snapshot, Target } from "../adapters/ToolAdapter.ts";
import type { Changes } from "../formats/ConfigFormat.ts";
import { EntryHasher } from "../store/EntryHasher.ts";
import { StateStore } from "../store/StateStore.ts";
import type { Entry, WirebayState } from "../types.ts";

/** Something that stops an entry from being written. */
export interface Issue {
  name: string;
  /** `conflict`: an entry wirebay didn't create; `drift`: a managed entry edited by hand. */
  kind: "conflict" | "drift";
  message: string;
}

/** The planned changes for one tool file. */
export interface TargetPlan {
  target: Target;
  snapshot: Snapshot;
  changes: Changes;
  unchanged: string[];
  issues: Issue[];
  /** New file content (same as the old one when nothing changes). */
  after: string;
  /** Hashes to record after applying: actual entries and the entries wirebay asked for. */
  next: { entries: Record<string, string>; desired: Record<string, string> };
}

/** Inputs for {@link Reconciler.plan}. */
export interface PlanOptions {
  /** Desired entries for the servers this operation is about. */
  desired: Record<string, Entry>;
  /** Server names this operation is about; managed entries outside it are left alone. */
  scopeNames?: Set<string>;
  /** Overwrite conflicts and drift. */
  force?: boolean;
}

/**
 * The sync rules:
 * - entries wirebay never wrote are never touched (a name clash is a **conflict**);
 * - managed entries edited by hand are **drift** and need `--force`;
 * - managed entries that are no longer wanted are pruned.
 */
export class Reconciler {
  private readonly adapters: AdapterFactory;

  constructor(adapters: AdapterFactory) {
    this.adapters = adapters;
  }

  /** Work out what would change in one tool file. Reads the file; writes nothing. */
  plan(target: Target, state: WirebayState, options: PlanOptions): TargetPlan {
    const adapter = this.adapters.for(target.tool);
    const snapshot = adapter.read(target);
    const record = StateStore.fileRecord(state, target.tool.id, target.scope, target.file);
    const recorded = { ...(record?.entries ?? {}) };
    const recordedDesired = { ...(record?.desired ?? record?.entries ?? {}) };
    const inScope = (name: string) => !options.scopeNames || options.scopeNames.has(name);

    const changes: Changes = { set: {}, remove: [] };
    const unchanged: string[] = [];
    const issues: Issue[] = [];
    const next = { entries: { ...recorded }, desired: { ...recordedDesired } };

    for (const [name, entry] of Object.entries(options.desired)) {
      if (!inScope(name)) continue;
      const current = snapshot.entries[name];
      const managed = name in recorded;
      const wantHash = EntryHasher.hash(entry);
      if (snapshot.locked.has(name)) {
        issues.push({ name, kind: "conflict", message: `"${name}" is already defined in ${target.file} outside the wirebay block. Remove it there (or rename the server) and sync again.` });
        continue;
      }
      const untouched = current !== undefined && managed && EntryHasher.hash(current) === recorded[name];
      if (current !== undefined && (EntryHasher.same(current, entry) || (untouched && recordedDesired[name] === wantHash))) {
        unchanged.push(name);
        next.entries[name] = EntryHasher.hash(current);
        next.desired[name] = wantHash;
        continue;
      }
      if (current !== undefined && !managed && !options.force) {
        issues.push({ name, kind: "conflict", message: `"${name}" already exists in ${target.file} and was not created by wirebay. Use --force to replace it.` });
        continue;
      }
      if (current !== undefined && managed && !untouched && !options.force) {
        issues.push({ name, kind: "drift", message: `"${name}" in ${target.file} was edited by hand since the last sync. Use --force to overwrite it.` });
        continue;
      }
      changes.set[name] = entry;
      next.entries[name] = wantHash;
      next.desired[name] = wantHash;
    }

    for (const name of Object.keys(recorded)) {
      if (!inScope(name) || name in options.desired) continue;
      const current = snapshot.entries[name];
      delete next.entries[name];
      delete next.desired[name];
      if (current === undefined) continue;
      if (EntryHasher.hash(current) !== recorded[name] && !options.force) {
        next.entries[name] = recorded[name]!;
        next.desired[name] = recordedDesired[name] ?? recorded[name]!;
        issues.push({ name, kind: "drift", message: `"${name}" in ${target.file} was edited by hand, so wirebay will not remove it. Use --force to remove it anyway.` });
        continue;
      }
      changes.remove.push(name);
    }

    const after = Reconciler.hasChangesIn(changes) ? adapter.render(target, snapshot, changes) : snapshot.text;
    return { target, snapshot, changes, unchanged, issues, after, next };
  }

  /** Write a plan's changes and record the result in `state` (the caller saves state). */
  apply(plan: TargetPlan, state: WirebayState): CommitResult | undefined {
    const { tool, scope, file } = plan.target;
    let result: CommitResult | undefined;
    if (Reconciler.hasChanges(plan)) {
      const adapter = this.adapters.for(tool);
      result = adapter.commit(plan.target, plan.snapshot, plan.changes, plan.after);
      if (result.via === "cli") {
        // The tool's CLI may normalise entries; record what it actually wrote.
        const written = adapter.read(plan.target).entries;
        for (const name of Object.keys(plan.changes.set)) if (written[name] !== undefined) plan.next.entries[name] = EntryHasher.hash(written[name]);
      }
    }
    const key = StateStore.key(tool.id, scope, file);
    if (Object.keys(plan.next.entries).length) state.files[key] = { tool: tool.id, scope, path: file, entries: plan.next.entries, desired: plan.next.desired };
    else delete state.files[key];
    return result;
  }

  /** True when the plan adds, updates or removes anything. */
  static hasChanges(plan: TargetPlan): boolean {
    return Reconciler.hasChangesIn(plan.changes);
  }

  /** A unified diff of the planned change. */
  static diff(plan: TargetPlan): string {
    return createTwoFilesPatch(plan.target.file, plan.target.file, plan.snapshot.text, plan.after, "current", "after sync", { context: 3 });
  }

  private static hasChangesIn(changes: Changes): boolean {
    return Object.keys(changes.set).length > 0 || changes.remove.length > 0;
  }
}
