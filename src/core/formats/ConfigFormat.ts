/**
 * The Strategy interface for reading and editing a tool's config file format.
 * @module
 */

import type { Entry } from "../types.ts";

/** Server entries found in a config file. */
export interface ReadResult {
  /** Every server entry under the root key, by name. */
  entries: Record<string, Entry>;
  /**
   * Names wirebay may not manage in place: entries that exist in a part of the file wirebay
   * doesn't own (for example TOML tables outside the managed block).
   */
  locked: Set<string>;
}

/** Entries to add or replace, and names to remove. */
export interface Changes {
  set: Record<string, Entry>;
  remove: string[];
}

/**
 * Reads and edits one config format. Implementations must leave everything they don't manage
 * untouched, byte for byte where the format allows it (comments, formatting, other settings).
 */
export interface ConfigFormat {
  /**
   * Find the server entries under `rootKey`.
   * @param text - Current file content (`""` when the file doesn't exist yet).
   * @param rootKey - Dot path to the servers map; `\.` is a literal dot.
   * @param file - File name for error messages.
   */
  read(text: string, rootKey: string, file: string): ReadResult;

  /**
   * Apply changes and return the new file content.
   * @param text - Current file content.
   * @param rootKey - Dot path to the servers map.
   * @param changes - Entries to set and names to remove.
   * @param file - File name for error messages.
   */
  write(text: string, rootKey: string, changes: Changes, file: string): string;
}

/** Split a root key on dots; `\.` is a literal dot (`amp\.mcpServers` is one key). */
export function splitRootKey(rootKey: string): string[] {
  return rootKey
    .split(/(?<!\\)\./)
    .map((k) => k.replace(/\\\./g, "."))
    .filter(Boolean);
}
