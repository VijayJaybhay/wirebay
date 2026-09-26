/**
 * Plans and applies the changes for one tool file by comparing three things:
 * the desired entries, what is actually in the file, and what wirebay wrote last time.
 * @module
 */

import { createTwoFilesPatch } from "diff";
import { parse, stripComments } from "jsonc-parser";
import type { AdapterFactory } from "../adapters/AdapterFactory.ts";
import type { CommitResult, Snapshot, Target } from "../adapters/ToolAdapter.ts";
import { splitRootKey, type Changes } from "../formats/ConfigFormat.ts";
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

/** Hashes recorded for a tool file: actual entries, and the entries wirebay asked for. */
export interface RecordedHashes {
  entries: Map<string, string>;
  desired: Map<string, string>;
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
  /** Hashes to record after applying. */
  next: RecordedHashes;
  /** True when wirebay created this file earlier (recorded in state). */
  created: boolean;
  /** Delete the file instead of writing `after`: wirebay created it (or it is an opt-in location) and nothing is left in it. */
  deleteFile: boolean;
}

/** Inputs for {@link Reconciler.plan}. */
export interface PlanOptions {
  /** Desired entries for the servers this operation is about. */
  desired: Record<string, Entry>;
  /** Server names this operation is about; managed entries outside it are left alone. */
  scopeNames?: Set<string>;
  /** Overwrite conflicts and drift. */
  force?: boolean;
  /**
   * The location is opt-in because another tool can't parse it: once its last managed entry is
   * removed, an empty file is deleted even if wirebay didn't record creating it (files from
   * earlier versions), because the empty file still breaks that other tool.
   */
  optIn?: boolean;
}

/**
 * The sync rules:
 * - entries wirebay never wrote are never touched (a name clash is a **conflict**);
 * - managed entries edited by hand are **drift** and need `--force`;
 * - managed entries that are no longer wanted are pruned.
 */
export class Reconciler {
  private readonly adapters: AdapterFactory;
  private readonly hasher = new EntryHasher();

  constructor(adapters: AdapterFactory) {
    this.adapters = adapters;
  }

  /** Work out what would change in one tool file. Reads the file; writes nothing. */
  plan(target: Target, state: WirebayState, options: PlanOptions): TargetPlan {
    const adapter = this.adapters.for(target.tool);
    const snapshot = adapter.read(target);
    const record = StateStore.fileRecord(state, target.tool.id, target.scope, target.file);
    const recorded = new Map(Object.entries(record?.entries ?? {}));
    const recordedDesired = new Map(Object.entries(record?.desired ?? record?.entries ?? {}));
    const inScope = (name: string): boolean => !options.scopeNames || options.scopeNames.has(name);

    const changes: Changes = { set: {}, remove: [] };
    const unchanged: string[] = [];
    const issues: Issue[] = [];
    const next: RecordedHashes = { entries: new Map(recorded), desired: new Map(recordedDesired) };

    for (const [name, entry] of Object.entries(options.desired)) {
      if (!inScope(name)) continue;
      const current = snapshot.entries[name];
      const recordedHash = recorded.get(name);
      const wantHash = this.hasher.hash(entry);
      if (snapshot.locked.has(name)) {
        issues.push({
          name,
          kind: "conflict",
          message: `"${name}" is already defined in ${target.file} outside the wirebay block. Remove it there (or rename the server) and sync again.`,
        });
        continue;
      }
      const untouched = current !== undefined && recordedHash !== undefined && this.hasher.hash(current) === recordedHash;
      if (current !== undefined && (this.hasher.same(current, entry) || (untouched && recordedDesired.get(name) === wantHash))) {
        unchanged.push(name);
        next.entries.set(name, this.hasher.hash(current));
        next.desired.set(name, wantHash);
        continue;
      }
      if (current !== undefined && recordedHash === undefined && !options.force) {
        issues.push({
          name,
          kind: "conflict",
          message: `"${name}" already exists in ${target.file} and was not created by wirebay. Use --force to replace it.`,
        });
        continue;
      }
      if (current !== undefined && recordedHash !== undefined && !untouched && !options.force) {
        issues.push({
          name,
          kind: "drift",
          message: `"${name}" in ${target.file} was edited by hand since the last sync. Use --force to overwrite it.`,
        });
        continue;
      }
      changes.set[name] = entry;
      next.entries.set(name, wantHash);
      next.desired.set(name, wantHash);
    }

    for (const [name, recordedHash] of recorded) {
      if (!inScope(name) || name in options.desired) continue;
      const current = snapshot.entries[name];
      next.entries.delete(name);
      next.desired.delete(name);
      if (current === undefined) continue;
      if (this.hasher.hash(current) !== recordedHash && !options.force) {
        next.entries.set(name, recordedHash);
        next.desired.set(name, recordedDesired.get(name) ?? recordedHash);
        issues.push({
          name,
          kind: "drift",
          message: `"${name}" in ${target.file} was edited by hand, so wirebay will not remove it. Use --force to remove it anyway.`,
        });
        continue;
      }
      changes.remove.push(name);
    }

    const after = Reconciler.hasChangesIn(changes) ? adapter.render(target, snapshot, changes) : snapshot.text;
    const created = record?.created === true;
    const key = StateStore.key(target.tool.id, target.scope, target.file);
    const deleteFile =
      snapshot.exists &&
      changes.remove.length > 0 &&
      next.entries.size === 0 &&
      (created || options.optIn === true) &&
      (target.tool.format === "json" || target.tool.format === "jsonc") &&
      Reconciler.isEmptyJson(after, target.tool.rootKey) &&
      !StateStore.sharedWithOthers(state, key, target.file);
    return { target, snapshot, changes, unchanged, issues, after, next, created, deleteFile };
  }

  /**
   * True when a JSON/JSONC text holds nothing but empty objects along the root key, e.g. `{}` or
   * `{ "servers": {} }`. Any comment, other key or value counts as content.
   */
  static isEmptyJson(text: string, rootKey: string): boolean {
    const compact = (s: string): string => s.replace(/\s/g, "");
    if (compact(stripComments(text)) !== compact(text)) return false; // has comments
    const keyPath = splitRootKey(rootKey);
    let node: unknown = parse(text);
    // Walk down the root key: every level may hold only the next key of the path, and the last level nothing.
    for (let depth = 0; depth <= keyPath.length; depth++) {
      if (typeof node !== "object" || node === null || Array.isArray(node)) return false;
      const keys = Object.keys(node);
      const expected = keyPath[depth];
      if (keys.length === 0) return true;
      if (expected === undefined || keys.length > 1 || keys[0] !== expected) return false;
      node = (node as Record<string, unknown>)[expected];
    }
    return false;
  }

  /** Write a plan's changes and record the result in `state` (the caller saves state). */
  apply(plan: TargetPlan, state: WirebayState): CommitResult | undefined {
    const { tool, scope, file } = plan.target;
    let result: CommitResult | undefined;
    const key = StateStore.key(tool.id, scope, file);
    const remaining = Object.fromEntries(Object.entries(state.files).filter(([k]) => k !== key));
    if (plan.deleteFile) {
      result = this.adapters.for(tool).remove(plan.target, plan.snapshot);
      state.files = remaining;
      return result;
    }
    if (Reconciler.hasChanges(plan)) {
      const adapter = this.adapters.for(tool);
      result = adapter.commit(plan.target, plan.snapshot, plan.changes, plan.after);
      if (result.via === "cli") {
        // The tool's CLI may normalise entries; record what it actually wrote.
        const written = adapter.read(plan.target).entries;
        for (const name of Object.keys(plan.changes.set)) {
          const entry = written[name];
          if (entry !== undefined) plan.next.entries.set(name, this.hasher.hash(entry));
        }
      }
    }
    // Remember files wirebay created, even once they're empty, so it may delete them later.
    const created = plan.created || (result?.via === "file" && !plan.snapshot.exists);
    state.files =
      plan.next.entries.size || created
        ? {
            ...remaining,
            [key]: {
              tool: tool.id,
              scope,
              path: file,
              entries: Object.fromEntries(plan.next.entries),
              desired: Object.fromEntries(plan.next.desired),
              ...(created ? { created: true as const } : {}),
            },
          }
        : remaining;
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
