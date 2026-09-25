/**
 * Order-independent hashing of tool entries, used to tell wirebay's writes apart from hand edits.
 * @module
 */

import { createHash } from "node:crypto";

/** Stable serialisation and hashing of JSON-like values. */
export class EntryHasher {
  private readonly length: number;

  /** @param length - Number of hex characters kept from the SHA-256 digest. */
  constructor(length = 16) {
    this.length = length;
  }

  /** JSON with object keys sorted, so `{a,b}` and `{b,a}` serialise the same. `undefined` fields are dropped. */
  stableStringify(value: unknown): string {
    if (Array.isArray(value)) return `[${value.map((v) => this.stableStringify(v)).join(",")}]`;
    if (value !== null && typeof value === "object") {
      const entries = Object.entries(value as Record<string, unknown>)
        .filter(([, v]) => v !== undefined)
        .sort(([a], [b]) => a.localeCompare(b));
      return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${this.stableStringify(v)}`).join(",")}}`;
    }
    return JSON.stringify(value);
  }

  /** A short SHA-256 of the stable serialisation. */
  hash(value: unknown): string {
    return createHash("sha256").update(this.stableStringify(value)).digest("hex").slice(0, this.length);
  }

  /** Deep equality that ignores key order. */
  same(a: unknown, b: unknown): boolean {
    return this.stableStringify(a) === this.stableStringify(b);
  }
}
