/**
 * `~/.wirebay/state.json`: the applied state (which entries wirebay wrote, and their hashes).
 * @module
 */

import type { SafeFileWriter } from "../io/SafeFileWriter.ts";
import type { WirebayPaths } from "../platform/WirebayPaths.ts";
import type { ScopeName, StateFile, WirebayState } from "../types.ts";

/** Loads and saves what wirebay has written into each tool file. */
export class StateStore {
  /** Current state file format version. */
  static readonly version = 1;

  private readonly paths: WirebayPaths;
  private readonly writer: SafeFileWriter;

  constructor(paths: WirebayPaths, writer: SafeFileWriter) {
    this.paths = paths;
    this.writer = writer;
  }

  /** Read the state (empty when wirebay hasn't written anything yet). */
  load(): WirebayState {
    const found = this.writer.readJson(this.paths.stateFile) as WirebayState | undefined;
    return found ?? { version: StateStore.version, files: {} };
  }

  /** Write the state atomically. */
  save(state: WirebayState): void {
    this.writer.writeJson(this.paths.stateFile, state);
  }

  /** The key a tool file is recorded under. */
  static key(tool: string, scope: ScopeName, file: string): string {
    return `${tool}|${scope}|${file}`;
  }

  /** The record for one tool file, if wirebay has written to it. */
  static fileRecord(state: WirebayState, tool: string, scope: ScopeName, file: string): StateFile | undefined {
    return state.files[StateStore.key(tool, scope, file)];
  }

  /**
   * Tools with wirebay-managed entries.
   * @param server - Only files holding this server.
   * @param where - Only files matching this predicate (e.g. one scope or one project).
   */
  static toolsWithEntries(state: WirebayState, server?: string, where: (file: StateFile) => boolean = () => true): string[] {
    return [
      ...new Set(
        Object.values(state.files)
          .filter((f) => Object.keys(f.entries).length > 0)
          .filter((f) => (server === undefined || server in f.entries) && where(f))
          .map((f) => f.tool),
      ),
    ].sort();
  }

  /**
   * True when another record (another tool or scope) still has managed entries in the same file.
   * Paths compare case-insensitively on Windows and macOS.
   */
  static sharedWithOthers(state: WirebayState, key: string, file: string): boolean {
    const norm = (p: string): string => (process.platform === "linux" ? p : p.toLowerCase());
    return Object.entries(state.files).some(([k, f]) => k !== key && norm(f.path) === norm(file) && Object.keys(f.entries).length > 0);
  }
}
