/**
 * How wirebay reads and writes one tool's config file.
 * @module
 */

import type { BackupManager } from "../io/BackupManager.ts";
import type { SafeFileWriter } from "../io/SafeFileWriter.ts";
import type { Changes, ConfigFormat } from "../formats/ConfigFormat.ts";
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
  commit(target: Target, snapshot: Snapshot, _changes: Changes, newText: string): CommitResult {
    const backup = this.deps.backups.backup(target.tool.id, target.file);
    this.deps.writer.write(target.file, newText, { expectedMtime: snapshot.mtime });
    return { via: "file", backup };
  }
}
