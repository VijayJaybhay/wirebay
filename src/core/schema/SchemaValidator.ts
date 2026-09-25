/**
 * JSON Schema validation for server definitions, tool manifests, the user config and project configs,
 * using the schemas shipped in `schemas/`.
 * @module
 */

import { readFileSync } from "node:fs";
import { Ajv, type ErrorObject, type ValidateFunction } from "ajv";
import { WirebayPaths } from "../platform/WirebayPaths.ts";

/** The schemas wirebay ships. */
export type SchemaName = "server" | "tool" | "config" | "project";

/** Validates data against the bundled JSON Schemas. Compiled validators are cached per instance. */
export class SchemaValidator {
  private readonly ajv = new Ajv({ allErrors: true, strict: false });
  private readonly cache = new Map<SchemaName, ValidateFunction>();

  /**
   * Validate data against a bundled schema.
   * @returns Human-readable problems; an empty array means valid.
   */
  validate(schema: SchemaName, data: unknown): string[] {
    const fn = this.compiled(schema);
    if (fn(data)) return [];
    return (fn.errors ?? []).map((e) => this.describe(e));
  }

  private compiled(schema: SchemaName): ValidateFunction {
    const cached = this.cache.get(schema);
    if (cached) return cached;
    const source = JSON.parse(readFileSync(WirebayPaths.packagePath("schemas", `${schema}.schema.json`), "utf8")) as object;
    const fn = this.ajv.compile(source);
    this.cache.set(schema, fn);
    return fn;
  }

  private describe(e: ErrorObject): string {
    const where = e.instancePath || "(root)";
    if (e.keyword === "additionalProperties") {
      return `${where}: unknown property "${(e.params as { additionalProperty: string }).additionalProperty}"`;
    }
    return `${where}: ${e.message ?? e.keyword}`;
  }
}
