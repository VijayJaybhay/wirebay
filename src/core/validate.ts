// JSON Schema validation for server definitions, tool manifests and the user config.

import { readFileSync } from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import type { ErrorObject, ValidateFunction } from "ajv";
import { packagePaths } from "./paths.ts";

const require = createRequire(import.meta.url);
// ajv ships CommonJS; loading it through require keeps typings simple.
const Ajv = require("ajv") as typeof import("ajv").default;

export type SchemaName = "server" | "tool" | "config";

const cache = new Map<SchemaName, ValidateFunction>();

function validator(name: SchemaName): ValidateFunction {
  let fn = cache.get(name);
  if (!fn) {
    const ajv = new Ajv({ allErrors: true, strict: false });
    const schema = JSON.parse(readFileSync(path.join(packagePaths.schemas, `${name}.schema.json`), "utf8"));
    fn = ajv.compile(schema);
    cache.set(name, fn);
  }
  return fn;
}

/** Validate data against one of the bundled schemas. Returns readable error lines (empty when valid). */
export function validateAgainst(name: SchemaName, data: unknown): string[] {
  const fn = validator(name);
  if (fn(data)) return [];
  return (fn.errors ?? []).map(formatError);
}

function formatError(e: ErrorObject): string {
  const where = e.instancePath || "(root)";
  if (e.keyword === "additionalProperties") {
    return `${where}: unknown property "${(e.params as { additionalProperty: string }).additionalProperty}"`;
  }
  return `${where}: ${e.message}`;
}
