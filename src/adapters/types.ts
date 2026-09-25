// The adapter contract: how wirebay reads and writes one tool's config file.
// Almost every tool is handled by the generic adapter driven by its tool.json.

import type { Entry, ScopeName, ToolManifest } from "../core/types.ts";

export interface Target {
  tool: ToolManifest;
  scope: ScopeName;
  file: string;
}

export interface Snapshot {
  /** Current file text ("" when the file does not exist yet). */
  text: string;
  exists: boolean;
  mtime?: number;
  /** Every server entry in the file. */
  entries: Record<string, Entry>;
  /** Names wirebay may not manage in place (e.g. TOML entries outside the managed block). */
  locked: Set<string>;
}

export interface Changes {
  set: Record<string, Entry>;
  remove: string[];
}

export interface Adapter {
  read(target: Target): Snapshot;
  /** Produce the new file text. Pure: no IO. */
  render(target: Target, snapshot: Snapshot, changes: Changes): string;
  /** Write the result. Default: backup + atomic write. Overrides may call the tool's own CLI instead. */
  commit(target: Target, snapshot: Snapshot, changes: Changes, newText: string): { via: "file" | "cli"; backup?: string };
}
