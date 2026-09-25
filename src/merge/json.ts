// JSON / JSONC edits that keep comments, key order and formatting.
// jsonc-parser's own insert/remove reformats neighbouring entries, so inserts and removals
// are done here with precise text edits; only replacing an existing value uses jsonc-parser.

import { applyEdits, findNodeAtLocation, modify, parse, parseTree, type FormattingOptions, type Node, type ParseError } from "jsonc-parser";
import { WirebayError } from "../core/errors.ts";
import type { Entry } from "../core/types.ts";

/** Split a root key on dots; `\.` is a literal dot (e.g. `amp\.mcpServers` is one key). */
export function keyPath(rootKey: string): string[] {
  return rootKey
    .split(/(?<!\\)\./)
    .map((k) => k.replace(/\\\./g, "."))
    .filter(Boolean);
}

function parseOrThrow(text: string, file: string): unknown {
  const errors: ParseError[] = [];
  const value = parse(text, errors, { allowTrailingComma: true, disallowComments: false });
  if (errors.length) {
    throw new WirebayError(`Could not parse ${file} (it is not valid JSON).`, {
      hint: "Fix the file by hand, or restore a backup with `wirebay restore`.",
    });
  }
  return value;
}

/** Every server entry currently under rootKey. */
export function readJsonEntries(text: string, rootKey: string, file = "config file"): Record<string, Entry> {
  if (!text.trim()) return {};
  let node = parseOrThrow(text, file) as Record<string, unknown> | undefined;
  for (const k of keyPath(rootKey)) {
    node = node && typeof node === "object" ? (node[k] as Record<string, unknown> | undefined) : undefined;
  }
  return node && typeof node === "object" && !Array.isArray(node) ? (node as Record<string, Entry>) : {};
}

interface Style {
  eol: string;
  unit: string;
}

function detectStyle(text: string): Style {
  const eol = text.includes("\r\n") ? "\r\n" : "\n";
  const m = text.match(/\n([ \t]+)["{\[]/);
  return { eol, unit: m?.[1] ?? "  " };
}

function formattingOptions(style: Style): FormattingOptions {
  const tabs = style.unit.includes("\t");
  return { insertSpaces: !tabs, tabSize: tabs ? 1 : style.unit.length, eol: style.eol };
}

/** Leading whitespace of the line containing `offset`. */
function lineIndent(text: string, offset: number): string {
  const start = text.lastIndexOf("\n", offset - 1) + 1;
  return text.slice(start).match(/^[ \t]*/)![0];
}

function pretty(value: unknown, indent: string, style: Style): string {
  return JSON.stringify(value, null, style.unit).replace(/\n/g, style.eol + indent);
}

/** Insert "key": value as the last property of an object node. */
function insertProperty(text: string, obj: Node, key: string, value: unknown, style: Style): string {
  const children = obj.children ?? [];
  if (children.length) {
    const last = children[children.length - 1]!;
    const indent = lineIndent(text, children[0]!.offset);
    const at = last.offset + last.length;
    const prop = `${JSON.stringify(key)}: ${pretty(value, indent, style)}`;
    // Keep a trailing "// comment" on the previous entry's line where it is.
    const lineEnd = text.indexOf("\n", at);
    const restOfLine = lineEnd < 0 ? text.slice(at) : text.slice(at, lineEnd);
    if (lineEnd >= 0 && /^\s*\/\//.test(restOfLine)) {
      const end = text[lineEnd - 1] === "\r" ? lineEnd - 1 : lineEnd;
      return `${text.slice(0, at)},${text.slice(at, end)}${style.eol}${indent}${prop}${text.slice(end)}`;
    }
    return `${text.slice(0, at)},${style.eol}${indent}${prop}${text.slice(at)}`;
  }
  const outer = lineIndent(text, obj.offset);
  const indent = outer + style.unit;
  const inner = `${style.eol}${indent}${JSON.stringify(key)}: ${pretty(value, indent, style)}${style.eol}${outer}`;
  return text.slice(0, obj.offset + 1) + inner + text.slice(obj.offset + obj.length - 1);
}

/** Remove the property that owns `valueNode`, including its separating comma. */
function removeProperty(text: string, valueNode: Node): string {
  const prop = valueNode.parent!;
  const siblings = prop.parent!.children!;
  const i = siblings.indexOf(prop);
  if (siblings.length === 1) {
    const obj = prop.parent!;
    return text.slice(0, obj.offset + 1) + text.slice(obj.offset + obj.length - 1);
  }
  if (i < siblings.length - 1) {
    // Remove from the start of this line (or the property) up to the next property.
    const lineStart = text.lastIndexOf("\n", prop.offset - 1) + 1;
    const onlyWhitespaceBefore = /^[ \t]*$/.test(text.slice(lineStart, prop.offset));
    const nextLineStart = text.lastIndexOf("\n", siblings[i + 1]!.offset - 1) + 1;
    const nextOnOwnLine = /^[ \t]*$/.test(text.slice(nextLineStart, siblings[i + 1]!.offset));
    if (onlyWhitespaceBefore && nextOnOwnLine && nextLineStart > prop.offset) {
      return text.slice(0, lineStart) + text.slice(nextLineStart);
    }
    return text.slice(0, prop.offset) + text.slice(siblings[i + 1]!.offset);
  }
  // Last property: drop the separating comma after the previous one, and this property's line(s),
  // keeping any comment that follows the previous property.
  const prev = siblings[i - 1]!;
  const prevEnd = prev.offset + prev.length;
  const comma = text.indexOf(",", prevEnd);
  const newline = text.lastIndexOf("\n", prop.offset - 1);
  if (comma >= 0 && comma < newline && /^[ \t]*$/.test(text.slice(newline + 1, prop.offset))) {
    const cut = text[newline - 1] === "\r" ? newline - 1 : newline;
    return text.slice(0, comma) + text.slice(comma + 1, cut) + text.slice(prop.offset + prop.length);
  }
  return text.slice(0, prevEnd) + text.slice(prop.offset + prop.length);
}

/** Set and remove entries under rootKey. Everything else in the file is left byte for byte. */
export function editJson(text: string, rootKey: string, set: Record<string, Entry>, remove: string[], file = "config file"): string {
  const style = detectStyle(text);
  let out = text.trim() ? text : `{}${style.eol}`;
  parseOrThrow(out, file);
  const base = keyPath(rootKey);

  for (const name of remove) {
    const node = findNodeAtLocation(parseTree(out)!, [...base, name]);
    if (node) out = removeProperty(out, node);
  }

  for (const [name, entry] of Object.entries(set)) {
    const root = parseTree(out)!;
    const existing = findNodeAtLocation(root, [...base, name]);
    if (existing) {
      out = applyEdits(out, modify(out, [...base, name], entry, { formattingOptions: formattingOptions(style) }));
      continue;
    }
    // Find the deepest existing object on the path and insert the rest as a nested value.
    let depth = base.length;
    let parent = findNodeAtLocation(root, base);
    while (!parent && depth > 0) {
      depth--;
      parent = depth === 0 ? root : findNodeAtLocation(root, base.slice(0, depth));
    }
    parent ??= root;
    if (parent.type !== "object") {
      throw new WirebayError(`${file}: "${base.slice(0, depth).join(".")}" is not an object.`, { hint: "Fix the file by hand, or restore a backup." });
    }
    const rest = [...base.slice(depth), name];
    const value = rest.slice(1).reduceRight<unknown>((acc, k) => ({ [k]: acc }), entry);
    out = insertProperty(out, parent, rest[0]!, value, style);
  }
  return out.endsWith(style.eol) ? out : out + style.eol;
}
