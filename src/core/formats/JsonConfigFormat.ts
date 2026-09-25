/**
 * JSON and JSONC (JSON with comments) config files.
 * @module
 */

import { applyEdits, findNodeAtLocation, modify, parse, parseTree, type FormattingOptions, type Node, type ParseError } from "jsonc-parser";
import { ConfigParseError, WirebayError } from "../errors.ts";
import type { Entry } from "../types.ts";
import { defined } from "../util/values.ts";
import { splitRootKey, type Changes, type ConfigFormat, type ReadResult } from "./ConfigFormat.ts";

/** Detected indentation and line endings of a file. */
interface Style {
  eol: string;
  unit: string;
}

/**
 * Edits JSON/JSONC while keeping comments, key order and formatting.
 *
 * jsonc-parser's own insert/remove reformats neighbouring entries, so inserts and removals are
 * precise text edits here; only replacing an existing value goes through jsonc-parser.
 */
export class JsonConfigFormat implements ConfigFormat {
  read(text: string, rootKey: string, file: string): ReadResult {
    if (!text.trim()) return { entries: {}, locked: new Set() };
    let node: unknown = this.parseOrThrow(text, file);
    for (const k of splitRootKey(rootKey)) node = JsonConfigFormat.isObject(node) ? node[k] : undefined;
    const entries = JsonConfigFormat.isObject(node) ? (node as Record<string, Entry>) : {};
    return { entries, locked: new Set() };
  }

  write(text: string, rootKey: string, changes: Changes, file: string): string {
    const style = this.detectStyle(text);
    let out = text.trim() ? text : `{}${style.eol}`;
    this.parseOrThrow(out, file);
    const base = splitRootKey(rootKey);

    for (const name of changes.remove) {
      const node = findNodeAtLocation(this.tree(out), [...base, name]);
      if (node) out = this.removeProperty(out, node);
    }
    for (const [name, entry] of Object.entries(changes.set)) out = this.setProperty(out, base, name, entry, style, file);
    return out.endsWith(style.eol) ? out : out + style.eol;
  }

  private tree(text: string): Node {
    return defined(parseTree(text), "a parsable JSON document");
  }

  private setProperty(text: string, base: string[], name: string, entry: Entry, style: Style, file: string): string {
    const root = this.tree(text);
    if (findNodeAtLocation(root, [...base, name])) {
      return applyEdits(text, modify(text, [...base, name], entry, { formattingOptions: this.formatting(style) }));
    }
    // Insert into the deepest existing object on the path, nesting the rest.
    let depth = base.length;
    let parent = findNodeAtLocation(root, base);
    while (!parent && depth > 0) {
      depth--;
      parent = depth === 0 ? root : findNodeAtLocation(root, base.slice(0, depth));
    }
    const container = parent ?? root;
    if (container.type !== "object") {
      throw new WirebayError(`${file}: "${base.slice(0, depth).join(".")}" is not an object.`, {
        hint: "Fix the file by hand, or restore a backup.",
      });
    }
    const [firstKey, ...nested] = [...base.slice(depth), name];
    return this.insertProperty(text, container, defined(firstKey, "a key to insert"), JsonConfigFormat.rewrap(nested, entry), style);
  }

  /** Wrap an entry under the remaining keys: `["a", "b"]` → `{ a: { b: entry } }`; `[]` → `entry`. */
  private static rewrap(keys: string[], entry: Entry): unknown {
    return keys.reduceRight<unknown>((acc, k) => ({ [k]: acc }), entry);
  }

  private parseOrThrow(text: string, file: string): unknown {
    const errors: ParseError[] = [];
    const value: unknown = parse(text, errors, { allowTrailingComma: true, disallowComments: false });
    if (errors.length) throw new ConfigParseError(file, "it is not valid JSON");
    return value;
  }

  private detectStyle(text: string): Style {
    const eol = text.includes("\r\n") ? "\r\n" : "\n";
    const indent = /\n([ \t]+)["{[]/.exec(text)?.[1];
    return { eol, unit: indent ?? "  " };
  }

  private formatting(style: Style): FormattingOptions {
    const tabs = style.unit.includes("\t");
    return { insertSpaces: !tabs, tabSize: tabs ? 1 : style.unit.length, eol: style.eol };
  }

  /** Leading whitespace of the line containing `offset`. */
  private lineIndent(text: string, offset: number): string {
    const start = text.lastIndexOf("\n", offset - 1) + 1;
    return /^[ \t]*/.exec(text.slice(start))?.[0] ?? "";
  }

  private pretty(value: unknown, indent: string, style: Style): string {
    return JSON.stringify(value, null, style.unit).replace(/\n/g, style.eol + indent);
  }

  /** Insert `"key": value` as the last property of an object node. */
  private insertProperty(text: string, obj: Node, key: string, value: unknown, style: Style): string {
    const children = obj.children ?? [];
    const first = children[0];
    const last = children[children.length - 1];
    if (first && last) {
      const indent = this.lineIndent(text, first.offset);
      const at = last.offset + last.length;
      const prop = `${JSON.stringify(key)}: ${this.pretty(value, indent, style)}`;
      // Keep a trailing "// comment" on the previous entry's line where it is.
      const lineEnd = text.indexOf("\n", at);
      const restOfLine = lineEnd < 0 ? text.slice(at) : text.slice(at, lineEnd);
      if (lineEnd >= 0 && /^\s*\/\//.test(restOfLine)) {
        const end = text[lineEnd - 1] === "\r" ? lineEnd - 1 : lineEnd;
        return `${text.slice(0, at)},${text.slice(at, end)}${style.eol}${indent}${prop}${text.slice(end)}`;
      }
      return `${text.slice(0, at)},${style.eol}${indent}${prop}${text.slice(at)}`;
    }
    const outer = this.lineIndent(text, obj.offset);
    const indent = outer + style.unit;
    const inner = `${style.eol}${indent}${JSON.stringify(key)}: ${this.pretty(value, indent, style)}${style.eol}${outer}`;
    return text.slice(0, obj.offset + 1) + inner + text.slice(obj.offset + obj.length - 1);
  }

  /** Remove the property that owns `valueNode`, including its separating comma. */
  private removeProperty(text: string, valueNode: Node): string {
    const prop = defined(valueNode.parent, "the property of a JSON value");
    const obj = defined(prop.parent, "the object containing a property");
    const siblings = obj.children ?? [];
    const i = siblings.indexOf(prop);
    const next = siblings[i + 1];
    const prev = siblings[i - 1];
    if (siblings.length === 1) return text.slice(0, obj.offset + 1) + text.slice(obj.offset + obj.length - 1);
    if (next) {
      const lineStart = text.lastIndexOf("\n", prop.offset - 1) + 1;
      const nextLineStart = text.lastIndexOf("\n", next.offset - 1) + 1;
      const ownLine = /^[ \t]*$/.test(text.slice(lineStart, prop.offset));
      const nextOwnLine = /^[ \t]*$/.test(text.slice(nextLineStart, next.offset));
      if (ownLine && nextOwnLine && nextLineStart > prop.offset) return text.slice(0, lineStart) + text.slice(nextLineStart);
      return text.slice(0, prop.offset) + text.slice(next.offset);
    }
    // Last property: drop the comma after the previous one and this property's line(s),
    // keeping any comment that follows the previous property.
    const previous = defined(prev, "a previous sibling");
    const prevEnd = previous.offset + previous.length;
    const comma = text.indexOf(",", prevEnd);
    const newline = text.lastIndexOf("\n", prop.offset - 1);
    if (comma >= 0 && comma < newline && /^[ \t]*$/.test(text.slice(newline + 1, prop.offset))) {
      const cut = text[newline - 1] === "\r" ? newline - 1 : newline;
      return text.slice(0, comma) + text.slice(comma + 1, cut) + text.slice(prop.offset + prop.length);
    }
    return text.slice(0, prevEnd) + text.slice(prop.offset + prop.length);
  }

  private static isObject(value: unknown): value is Record<string, unknown> {
    return value !== null && typeof value === "object" && !Array.isArray(value);
  }
}
