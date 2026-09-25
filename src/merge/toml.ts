// TOML edits. TOML libraries drop comments when they rewrite a file, so wirebay owns one
// clearly marked block and never touches anything outside it.

import { parse, stringify } from "smol-toml";
import { WirebayError } from "../core/errors.ts";
import type { Entry } from "../core/types.ts";
import { keyPath } from "./json.ts";

export const BLOCK_START = "# >>> wirebay managed: do not edit by hand, run `wirebay sync` >>>";
export const BLOCK_END = "# <<< wirebay managed <<<";

interface Split {
  before: string;
  block: string;
  after: string;
  found: boolean;
}

export function splitBlock(text: string): Split {
  const start = text.indexOf(BLOCK_START);
  const end = text.indexOf(BLOCK_END);
  if (start < 0 || end < start) return { before: text, block: "", after: "", found: false };
  const endLine = text.indexOf("\n", end);
  return {
    before: text.slice(0, start),
    block: text.slice(start + BLOCK_START.length, end),
    after: endLine < 0 ? "" : text.slice(endLine + 1),
    found: true,
  };
}

function parseOrThrow(text: string, file: string): Record<string, unknown> {
  try {
    return parse(text) as Record<string, unknown>;
  } catch (err) {
    throw new WirebayError(`Could not parse ${file} as TOML: ${(err as Error).message.split("\n")[0]}`, {
      hint: "Fix the file by hand, or restore a backup with `wirebay restore`.",
    });
  }
}

function dig(obj: Record<string, unknown>, rootKey: string): Record<string, Entry> {
  let node: unknown = obj;
  for (const k of keyPath(rootKey)) node = node && typeof node === "object" ? (node as Record<string, unknown>)[k] : undefined;
  return node && typeof node === "object" ? (node as Record<string, Entry>) : {};
}

/** Entries inside the managed block, and names defined elsewhere in the file. */
export function readTomlEntries(text: string, rootKey: string, file = "config file"): { managed: Record<string, Entry>; outside: Record<string, Entry> } {
  const { before, block, after } = splitBlock(text);
  return {
    managed: block.trim() ? dig(parseOrThrow(block, file), rootKey) : {},
    outside: dig(parseOrThrow(before + "\n" + after, file), rootKey),
  };
}

function nest(rootKey: string, value: Record<string, Entry>): Record<string, unknown> {
  return keyPath(rootKey)
    .reverse()
    .reduce<Record<string, unknown>>((acc, k) => ({ [k]: acc }), value);
}

/** Rewrite the managed block so it holds exactly `entries`. Text outside the block is kept byte for byte. */
export function writeTomlBlock(text: string, rootKey: string, entries: Record<string, Entry>): string {
  const split = splitBlock(text);
  const body = Object.keys(entries).length ? `${BLOCK_START}\n${stringify(nest(rootKey, entries)).trim()}\n${BLOCK_END}\n` : "";
  if (split.found) {
    // When the block goes away, also drop the blank separator line wirebay added before it.
    const before = body ? split.before : split.before.replace(/\n\n$/, "\n");
    return before + body + split.after;
  }
  if (!body) return text;
  const prefix = text.length === 0 ? "" : text.endsWith("\n\n") ? text : text.endsWith("\n") ? text + "\n" : text + "\n\n";
  return prefix + body;
}
