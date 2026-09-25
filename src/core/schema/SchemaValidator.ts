/**
 * JSON Schema validation for server definitions, tool manifests and the user config,
 * using the schemas shipped in `schemas/`.
 * @module
 */

import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import type { ErrorObject, ValidateFunction } from "ajv";
import { WirebayPaths } from "../platform/WirebayPaths.ts";

const require = createRequire(import.meta.url);
// ajv ships CommonJS; loading it through require keeps its typings simple.
const Ajv = require("ajv") as typeof import("ajv").default;

/** The schemas wirebay ships. */
export type SchemaName = "server" | "tool" | "config";

/** Validates data against the bundled JSON Schemas. Compiled validators are cached. */
export class SchemaValidator {
  private static readonly cache = new Map<SchemaName, ValidateFunction>();

  /**
   * Validate data against a bundled schema.
   * @returns Human-readable problems; an empty array means valid.
   */
  static validate(schema: SchemaName, data: unknown): string[] {
    const fn = SchemaValidator.compiled(schema);
    if (fn(data)) return [];
    return (fn.errors ?? []).map((e) => SchemaValidator.describe(e));
  }

  private static compiled(schema: SchemaName): ValidateFunction {
    let fn = SchemaValidator.cache.get(schema);
    if (!fn) {
      const ajv = new Ajv({ allErrors: true, strict: false });
      fn = ajv.compile(JSON.parse(readFileSync(WirebayPaths.packagePath("schemas", `${schema}.schema.json`), "utf8")));
      SchemaValidator.cache.set(schema, fn);
    }
    return fn;
  }

  private static describe(e: ErrorObject): string {
    const where = e.instancePath || "(root)";
    if (e.keyword === "additionalProperties") {
      return `${where}: unknown property "${(e.params as { additionalProperty: string }).additionalProperty}"`;
    }
    return `${where}: ${e.message}`;
  }
}
