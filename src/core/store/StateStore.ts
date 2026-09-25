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
    return this.writer.readJson<WirebayState>(this.paths.stateFile) ?? { version: StateStore.version, files: {} };
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

  /** Tools with wirebay-managed entries, optionally only those holding a given server. */
  static toolsWithEntries(state: WirebayState, server?: string): string[] {
    return [
      ...new Set(
        Object.values(state.files)
          .filter((f) => !server || server in f.entries)
          .map((f) => f.tool),
      ),
    ].sort();
  }
}
