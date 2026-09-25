/**
 * Every known server: built-in presets plus the user's own servers and preset overrides from
 * `~/.wirebay/servers/`.
 * @module
 */

import { existsSync, readdirSync, rmSync } from "node:fs";
import path from "node:path";
import { UsageError, WirebayError } from "../errors.ts";
import type { SafeFileWriter } from "../io/SafeFileWriter.ts";
import { WirebayPaths } from "../platform/WirebayPaths.ts";
import { SchemaValidator } from "../schema/SchemaValidator.ts";
import type { ServerDef } from "../types.ts";
import { ServerDefinition } from "./ServerDefinition.ts";

/** Words that can't be server names because the command grammar gives them meaning. */
export const RESERVED_WORDS: ReadonlySet<string> = new Set(["all", "everything", "to", "into", "on", "onto", "for", "from", "in", "and", "with", "none"]);

/**
 * Loads and caches server definitions. A user file named like a preset is deep-merged over it
 * (objects merge; arrays and values replace).
 */
export class ServerRegistry {
  private readonly paths: WirebayPaths;
  private readonly writer: SafeFileWriter;
  private cache?: Map<string, ServerDefinition>;

  constructor(paths: WirebayPaths, writer: SafeFileWriter) {
    this.paths = paths;
    this.writer = writer;
  }

  /** Built-in presets only. */
  presets(): Map<string, ServerDefinition> {
    const map = new Map<string, ServerDefinition>();
    for (const def of this.readDir(WirebayPaths.packagePath("presets"))) {
      ServerRegistry.assertValid(def, `presets/${def.name}.json`);
      map.set(def.name, new ServerDefinition({ ...def, source: "preset" }));
    }
    return map;
  }

  /** Every server: presets, user servers, and presets with user overrides applied. */
  all(): Map<string, ServerDefinition> {
    if (this.cache) return this.cache;
    const map = this.presets();
    const dir = this.paths.serversDir;
    if (existsSync(dir)) {
      for (const f of readdirSync(dir).filter((x) => x.endsWith(".json"))) {
        const file = path.join(dir, f);
        const user = this.writer.readJson<Partial<ServerDef>>(file);
        if (!user) continue;
        const name = user.name ?? path.basename(f, ".json");
        const preset = map.get(name);
        const merged = preset ? ServerRegistry.deepMerge(preset.data, { ...user, name }) : ({ ...user, name } as ServerDef);
        const { source: _ignored, ...toValidate } = merged;
        ServerRegistry.assertValid(toValidate, file);
        map.set(name, new ServerDefinition({ ...merged, source: preset ? "preset+user" : "user" }));
      }
    }
    this.cache = map;
    return map;
  }

  /** True when a server with this name exists. */
  has(name: string): boolean {
    return this.all().has(name);
  }

  /**
   * One server by name.
   * @throws {@link core/errors!WirebayError} with a hint to add it, when unknown.
   */
  get(name: string): ServerDefinition {
    const def = this.all().get(name);
    if (!def) {
      throw new WirebayError(`Unknown server "${name}".`, { hint: `Add it first: wirebay add ${name} --npx <package> (see \`wirebay presets\`).` });
    }
    return def;
  }

  /** Path of the user's definition file for a server. */
  userFile(name: string): string {
    return path.join(this.paths.serversDir, `${name}.json`);
  }

  /** Save a custom server or a preset override to `~/.wirebay/servers/<name>.json`. */
  saveUserDefinition(def: Partial<ServerDef> & { name: string }): string {
    const file = this.userFile(def.name);
    const { source: _ignored, ...clean } = def as ServerDef;
    this.writer.writeJson(file, { $schema: "https://raw.githubusercontent.com/VijayJaybhay/wirebay/main/schemas/server.schema.json", version: 1, ...clean });
    this.cache = undefined;
    return file;
  }

  /** Delete the user's definition file. Returns false when there was none. */
  deleteUserDefinition(name: string): boolean {
    const file = this.userFile(name);
    if (!existsSync(file)) return false;
    rmSync(file);
    this.cache = undefined;
    return true;
  }

  /**
   * Check a new server name: format, reserved words, and no clash with tool names
   * (which keeps the command grammar unambiguous).
   * @throws {@link core/errors!UsageError} explaining what to change.
   */
  static assertValidName(name: string, toolNames: Iterable<string>): void {
    if (!/^[a-z0-9][a-z0-9-]*$/.test(name)) {
      throw new UsageError(`"${name}" is not a valid server name.`, "Use lowercase letters, digits and dashes, e.g. my-server.");
    }
    if (RESERVED_WORDS.has(name)) throw new UsageError(`"${name}" is a reserved word.`, "Pick a different server name.");
    for (const t of toolNames) {
      if (t === name) throw new UsageError(`"${name}" is already the name of a tool.`, `Pick a different server name, e.g. ${name}-mcp.`);
    }
  }

  /** Deep merge where arrays and scalars in `over` replace those in `base`. */
  static deepMerge<T>(base: T, over: Partial<T>): T {
    const isObject = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
    if (!isObject(base) || !isObject(over)) return (over ?? base) as T;
    const out: Record<string, unknown> = { ...base };
    for (const [k, v] of Object.entries(over)) out[k] = isObject(v) && isObject(out[k]) ? ServerRegistry.deepMerge(out[k], v) : v;
    return out as T;
  }

  private readDir(dir: string): ServerDef[] {
    if (!existsSync(dir)) return [];
    return readdirSync(dir)
      .filter((f) => f.endsWith(".json") && !f.startsWith("_"))
      .map((f) => this.writer.readJson<ServerDef>(path.join(dir, f)))
      .filter((d): d is ServerDef => !!d);
  }

  private static assertValid(def: unknown, file: string): void {
    const errors = SchemaValidator.validate("server", def);
    if (errors.length) {
      throw new WirebayError(`Invalid server definition ${file}:\n  ${errors.join("\n  ")}`, { hint: "Fix the file (see schemas/server.schema.json)." });
    }
  }
}
