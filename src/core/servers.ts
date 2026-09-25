// Loads server definitions: built-in presets plus the user's own servers and overrides
// from ~/.wirebay/servers/. A user file with a preset's name is deep-merged over the preset.

import { existsSync, readdirSync, rmSync } from "node:fs";
import path from "node:path";
import { UsageError, WirebayError } from "./errors.ts";
import { readJsonIfExists, writeJson } from "./io.ts";
import { homePaths, packagePaths } from "./paths.ts";
import { varsIn, varsInArgs } from "./template.ts";
import type { Launch, ServerDef } from "./types.ts";
import { validateAgainst } from "./validate.ts";

export const RESERVED_WORDS = new Set([
  "all",
  "everything",
  "to",
  "into",
  "on",
  "for",
  "from",
  "in",
  "and",
  "with",
  "none",
]);

function readDefs(dir: string): ServerDef[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith(".json") && !f.startsWith("_"))
    .map((f) => readJsonIfExists<ServerDef>(path.join(dir, f))!)
    .filter(Boolean);
}

function assertValid(def: unknown, file: string): void {
  const errors = validateAgainst("server", def);
  if (errors.length) {
    throw new WirebayError(`Invalid server definition ${file}:\n  ${errors.join("\n  ")}`, {
      hint: "Fix the file (see schemas/server.schema.json).",
    });
  }
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

/** Deep merge where arrays and scalars in `over` replace those in `base`. */
export function deepMerge<T>(base: T, over: Partial<T>): T {
  if (!isPlainObject(base) || !isPlainObject(over)) return (over ?? base) as T;
  const out: Record<string, unknown> = { ...base };
  for (const [k, v] of Object.entries(over)) {
    out[k] = isPlainObject(v) && isPlainObject(out[k]) ? deepMerge(out[k], v) : v;
  }
  return out as T;
}

export function loadPresets(): Map<string, ServerDef> {
  const map = new Map<string, ServerDef>();
  for (const def of readDefs(packagePaths.presets)) {
    assertValid(def, `presets/${def.name}.json`);
    map.set(def.name, { ...def, source: "preset" });
  }
  return map;
}

/** Every known server: presets, user servers, and presets with user overrides applied. */
export function loadServers(): Map<string, ServerDef> {
  const map = loadPresets();
  const dir = homePaths.servers();
  if (existsSync(dir)) {
    for (const f of readdirSync(dir).filter((x) => x.endsWith(".json"))) {
      const file = path.join(dir, f);
      const user = readJsonIfExists<Partial<ServerDef>>(file);
      if (!user) continue;
      const name = user.name ?? path.basename(f, ".json");
      const preset = map.get(name);
      const merged = preset ? deepMerge(preset, { ...user, name }) : ({ ...user, name } as ServerDef);
      const { source: _drop, ...toValidate } = merged;
      assertValid(toValidate, file);
      map.set(name, { ...merged, source: preset ? "preset+user" : "user" });
    }
  }
  return map;
}

export function getServer(name: string, servers = loadServers()): ServerDef {
  const def = servers.get(name);
  if (!def) {
    throw new WirebayError(`Unknown server "${name}".`, {
      hint: `Add it first: wirebay add ${name} --npx <package> (or see \`wirebay presets\`).`,
    });
  }
  return def;
}

/** The launch spec in effect (the selected variant, or the default launch). */
export function effectiveLaunch(def: ServerDef): Launch {
  if (def.variant) {
    const v = def.variants?.[def.variant];
    if (!v) {
      throw new WirebayError(`Server "${def.name}" has no variant "${def.variant}".`, {
        hint: `Available variants: ${Object.keys(def.variants ?? {}).join(", ") || "none"}.`,
      });
    }
    return v;
  }
  return def.launch;
}

/** Every environment key this server may receive: declared secrets plus variables it references. */
export function declaredKeys(def: ServerDef): string[] {
  const keys = new Set<string>((def.secrets ?? []).map((s) => s.key));
  for (const v of Object.values(def.env ?? {})) varsIn(v).forEach((k) => keys.add(k));
  const launch = effectiveLaunch(def);
  if (launch.type === "stdio") {
    varsInArgs(launch.args).forEach((k) => keys.add(k));
  } else {
    varsIn(launch.url).forEach((k) => keys.add(k));
    for (const h of Object.values(launch.headers ?? {})) varsIn(h).forEach((k) => keys.add(k));
    if (launch.auth && "secret" in launch.auth) keys.add(launch.auth.secret);
  }
  return [...keys];
}

export function requiredKeys(def: ServerDef): string[] {
  const keys = (def.secrets ?? []).filter((s) => s.required).map((s) => s.key);
  const launch = effectiveLaunch(def);
  if (launch.type === "remote" && launch.auth && "secret" in launch.auth && !keys.includes(launch.auth.secret)) {
    keys.push(launch.auth.secret);
  }
  return keys;
}

/** Check a new server name: format, reserved words, and no clash with tool names (keeps the CLI unambiguous). */
export function assertValidServerName(name: string, toolNames: Iterable<string>): void {
  if (!/^[a-z0-9][a-z0-9-]*$/.test(name)) {
    throw new UsageError(`"${name}" is not a valid server name.`, "Use lowercase letters, digits and dashes, e.g. my-server.");
  }
  if (RESERVED_WORDS.has(name)) {
    throw new UsageError(`"${name}" is a reserved word.`, "Pick a different server name.");
  }
  for (const t of toolNames) {
    if (t === name) {
      throw new UsageError(`"${name}" is already the name of a tool.`, "Pick a different server name, e.g. " + name + "-mcp.");
    }
  }
}

export function userServerFile(name: string): string {
  return path.join(homePaths.servers(), `${name}.json`);
}

export function saveUserServer(def: Partial<ServerDef> & { name: string }): string {
  const file = userServerFile(def.name);
  const { source: _drop, ...clean } = def as ServerDef;
  writeJson(file, { $schema: "https://raw.githubusercontent.com/VijayJaybhay/wirebay/main/schemas/server.schema.json", version: 1, ...clean });
  return file;
}

export function deleteUserServer(name: string): boolean {
  const file = userServerFile(name);
  if (!existsSync(file)) return false;
  rmSync(file);
  return true;
}
