/**
 * Order-independent hashing of tool entries, used to tell wirebay's writes apart from hand edits.
 * @module
 */

import { createHash } from "node:crypto";

/** Stable serialisation and hashing of JSON-like values. */
export class EntryHasher {
  /** JSON with object keys sorted, so `{a,b}` and `{b,a}` serialise the same. `undefined` fields are dropped. */
  static stableStringify(value: unknown): string {
    if (Array.isArray(value)) return `[${value.map((v) => EntryHasher.stableStringify(v)).join(",")}]`;
    if (value && typeof value === "object") {
      const obj = value as Record<string, unknown>;
      return `{${Object.keys(obj)
        .filter((k) => obj[k] !== undefined)
        .sort()
        .map((k) => `${JSON.stringify(k)}:${EntryHasher.stableStringify(obj[k])}`)
        .join(",")}}`;
    }
    return JSON.stringify(value);
  }

  /** A short (16 hex chars) SHA-256 of the stable serialisation. */
  static hash(value: unknown): string {
    return createHash("sha256").update(EntryHasher.stableStringify(value)).digest("hex").slice(0, 16);
  }

  /** Deep equality that ignores key order. */
  static same(a: unknown, b: unknown): boolean {
    return EntryHasher.stableStringify(a) === EntryHasher.stableStringify(b);
  }
}
