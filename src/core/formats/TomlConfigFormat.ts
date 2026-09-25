/**
 * TOML config files (e.g. Codex `config.toml`) edited through a wirebay-owned managed block.
 * @module
 */

import { parse, stringify } from "smol-toml";
import { ConfigParseError } from "../errors.ts";
import type { Entry } from "../types.ts";
import { splitRootKey, type Changes, type ConfigFormat, type ReadResult } from "./ConfigFormat.ts";

/** The text before, inside and after the managed block. */
export interface BlockSplit {
  before: string;
  block: string;
  after: string;
  found: boolean;
}

/**
 * TOML libraries drop comments when they rewrite a file, so wirebay owns one clearly marked
 * block and never touches anything outside it. Entries defined outside the block are reported
 * as `locked` so the reconciler raises a conflict instead of shadowing them.
 */
export class TomlConfigFormat implements ConfigFormat {
  /** First line of the managed block. */
  static readonly blockStart = "# >>> wirebay managed: do not edit by hand, run `wirebay sync` >>>";
  /** Last line of the managed block. */
  static readonly blockEnd = "# <<< wirebay managed <<<";

  read(text: string, rootKey: string, file: string): ReadResult {
    const { before, block, after } = TomlConfigFormat.split(text);
    const managed = block.trim() ? TomlConfigFormat.dig(TomlConfigFormat.parseOrThrow(block, file), rootKey) : {};
    const outside = TomlConfigFormat.dig(TomlConfigFormat.parseOrThrow(before + "\n" + after, file), rootKey);
    return { entries: { ...outside, ...managed }, locked: new Set(Object.keys(outside)) };
  }

  write(text: string, rootKey: string, changes: Changes, file: string): string {
    const split = TomlConfigFormat.split(text);
    const managed = split.block.trim() ? TomlConfigFormat.dig(TomlConfigFormat.parseOrThrow(split.block, file), rootKey) : {};
    const removed = new Set(changes.remove);
    const next: Record<string, Entry> = {
      ...Object.fromEntries(Object.entries(managed).filter(([name]) => !removed.has(name))),
      ...changes.set,
    };

    const body = Object.keys(next).length
      ? `${TomlConfigFormat.blockStart}\n${stringify(TomlConfigFormat.nest(rootKey, next)).trim()}\n${TomlConfigFormat.blockEnd}\n`
      : "";
    if (split.found) {
      // When the block goes away, also drop the blank separator line wirebay added before it.
      const before = body ? split.before : split.before.replace(/\n\n$/, "\n");
      return before + body + split.after;
    }
    if (!body) return text;
    const prefix = text.length === 0 ? "" : text.endsWith("\n\n") ? text : text.endsWith("\n") ? text + "\n" : text + "\n\n";
    return prefix + body;
  }

  /** Split a file into the text before, inside and after the managed block. */
  static split(text: string): BlockSplit {
    const start = text.indexOf(TomlConfigFormat.blockStart);
    const end = text.indexOf(TomlConfigFormat.blockEnd);
    if (start < 0 || end < start) return { before: text, block: "", after: "", found: false };
    const endLine = text.indexOf("\n", end);
    return {
      before: text.slice(0, start),
      block: text.slice(start + TomlConfigFormat.blockStart.length, end),
      after: endLine < 0 ? "" : text.slice(endLine + 1),
      found: true,
    };
  }

  private static parseOrThrow(text: string, file: string): Record<string, unknown> {
    try {
      return parse(text);
    } catch (err) {
      const firstLine = (err as Error).message.split("\n")[0] ?? "";
      throw new ConfigParseError(file, `invalid TOML (${firstLine})`);
    }
  }

  private static dig(obj: Record<string, unknown>, rootKey: string): Record<string, Entry> {
    let node: unknown = obj;
    for (const k of splitRootKey(rootKey)) node = node && typeof node === "object" ? (node as Record<string, unknown>)[k] : undefined;
    return node && typeof node === "object" ? (node as Record<string, Entry>) : {};
  }

  private static nest(rootKey: string, value: Record<string, Entry>): Record<string, unknown> {
    return splitRootKey(rootKey)
      .reverse()
      .reduce<Record<string, unknown>>((acc, k) => ({ [k]: acc }), value);
  }
}
