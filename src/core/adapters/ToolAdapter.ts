/**
 * How wirebay reads and writes one tool's config file.
 * @module
 */

import { copyFileSync, rmSync } from "node:fs";
import { WirebayError } from "../errors.ts";
import type { BackupManager } from "../io/BackupManager.ts";
import type { SafeFileWriter } from "../io/SafeFileWriter.ts";
import type { Changes, ConfigFormat } from "../formats/ConfigFormat.ts";
import { EntryHasher } from "../store/EntryHasher.ts";
import type { Tool } from "../tools/Tool.ts";
import type { Entry, ScopeName } from "../types.ts";

/** A tool's config file for one scope. */
export interface Target {
  tool: Tool;
  scope: ScopeName;
  file: string;
}

/** A tool file as it was read, before any change. */
export interface Snapshot {
  /** Current content (`""` when the file doesn't exist yet). */
  text: string;
  exists: boolean;
  /** Modification time, used to detect concurrent edits. */
  mtime?: number;
  /** Every server entry in the file. */
  entries: Record<string, Entry>;
  /** Names wirebay may not manage in place (e.g. TOML entries outside the managed block). */
  locked: Set<string>;
}

/** How a change was written. */
export interface CommitResult {
  /** `file` = wirebay wrote the file; `cli` = the tool's own CLI did. */
  via: "file" | "cli";
  /** Path of the backup taken before writing, if any. */
  backup?: string;
  /** True when the file was deleted (wirebay created it and it became empty). */
  deleted?: boolean;
}

/** Services adapters need. */
export interface AdapterDeps {
  writer: SafeFileWriter;
  backups: BackupManager;
}

/**
 * Template Method base class. Subclasses keep the read/render steps and may override
 * {@link ToolAdapter.commit} (e.g. to go through the tool's own CLI).
 */
export abstract class ToolAdapter {
  protected readonly format: ConfigFormat;
  protected readonly deps: AdapterDeps;
  protected readonly hasher = new EntryHasher();

  /**
   * @param format - Strategy for the tool's file format.
   * @param deps - File writer and backup manager.
   */
  constructor(format: ConfigFormat, deps: AdapterDeps) {
    this.format = format;
    this.deps = deps;
  }

  /** Read the current file and the server entries in it. */
  read(target: Target): Snapshot {
    const text = this.deps.writer.read(target.file);
    const body = text ?? "";
    const { entries, locked } = this.format.read(body, target.tool.rootKey, target.file);
    return { text: body, exists: text !== undefined, mtime: this.deps.writer.mtime(target.file), entries, locked };
  }

  /** The file content after applying changes. Pure: does no IO. */
  render(target: Target, snapshot: Snapshot, changes: Changes): string {
    return this.format.write(snapshot.text, target.tool.rootKey, changes, target.file);
  }

  /**
   * Persist the new content: back up, then write atomically (refusing if the file changed
   * since it was read).
   */
  commit(target: Target, snapshot: Snapshot, changes: Changes, newText: string): CommitResult {
    const backup = this.deps.backups.backup(target.tool.id, target.file);
    this.deps.writer.write(target.file, newText, { expectedMtime: snapshot.mtime });
    this.verifyWrite(target, changes, backup);
    return { via: "file", backup };
  }

  /**
   * Read the file back and check every change landed exactly as intended. If the file no longer
   * parses or an entry differs, put the previous file back (or remove a file that didn't exist)
   * and stop, so a broken config is never left behind.
   * @throws {@link core/errors!WirebayError} when the check fails (after rolling back).
   */
  protected verifyWrite(target: Target, changes: Changes, backup: string | undefined): void {
    let problem: string | undefined;
    try {
      const { entries } = this.read(target);
      const wrong = Object.entries(changes.set).find(([name, entry]) => !this.hasher.same(entries[name], entry));
      const leftover = changes.remove.find((name) => entries[name] !== undefined);
      if (wrong) problem = `"${wrong[0]}" does not read back as written`;
      else if (leftover !== undefined) problem = `"${leftover}" is still there after removing it`;
    } catch (err) {
      problem = `the file no longer parses (${(err as Error).message})`;
    }
    if (problem === undefined) return;
    if (backup) copyFileSync(backup, target.file);
    else rmSync(target.file, { force: true });
    throw new WirebayError(`wirebay's change to ${target.file} didn't verify: ${problem}. The previous file was put back.`, {
      hint: "Nothing was changed. Please report this with `wirebay doctor --json` output: https://github.com/pragnalabs-ai/wirebay/issues",
    });
  }

  /**
   * Delete the file: back it up first (so `wirebay restore` can bring it back), then remove it,
   * refusing if it changed since it was read.
   */
  remove(target: Target, snapshot: Snapshot): CommitResult {
    const backup = this.deps.backups.backup(target.tool.id, target.file);
    this.deps.writer.remove(target.file, { expectedMtime: snapshot.mtime });
    return { via: "file", backup, deleted: true };
  }
}
