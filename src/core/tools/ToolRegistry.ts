/**
 * The tools directory: manifests shipped in `tools/` plus user manifests in `~/.wirebay/tools/`.
 * @module
 */

import { existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { WirebayError } from "../errors.ts";
import type { SafeFileWriter } from "../io/SafeFileWriter.ts";
import type { ExecutableResolver } from "../platform/ExecutableResolver.ts";
import { WirebayPaths } from "../platform/WirebayPaths.ts";
import { SchemaValidator } from "../schema/SchemaValidator.ts";
import type { ToolManifest } from "../types.ts";
import { Tool } from "./Tool.ts";

/** Loads and caches tool manifests. A user manifest with the same id replaces the packaged one. */
export class ToolRegistry {
  private readonly paths: WirebayPaths;
  private readonly writer: SafeFileWriter;
  private cache?: Tool[];

  constructor(paths: WirebayPaths, writer: SafeFileWriter) {
    this.paths = paths;
    this.writer = writer;
  }

  /** Every tool, sorted by id. */
  all(): Tool[] {
    if (this.cache) return this.cache;
    const byId = new Map<string, Tool>();
    for (const t of this.readDir(WirebayPaths.packagePath("tools"), "package")) byId.set(t.id, t);
    for (const t of this.readDir(this.paths.toolsDir, "user")) byId.set(t.id, t);
    this.cache = [...byId.values()].sort((a, b) => a.id.localeCompare(b.id));
    return this.cache;
  }

  /** Map of every id and alias to its tool id. */
  aliasMap(): Map<string, string> {
    const map = new Map<string, string>();
    for (const t of this.all()) for (const n of t.names) map.set(n, t.id);
    return map;
  }

  /** The tool id for an id or alias, or `undefined`. */
  resolveId(idOrAlias: string): string | undefined {
    return this.aliasMap().get(idOrAlias);
  }

  /**
   * A tool by id or alias.
   * @throws {@link core/errors!WirebayError} when unknown.
   */
  get(idOrAlias: string): Tool {
    const id = this.resolveId(idOrAlias);
    const tool = this.all().find((t) => t.id === id);
    if (!tool) throw new WirebayError(`Unknown tool "${idOrAlias}".`, { hint: "Run `wirebay tools` to see supported tools." });
    return tool;
  }

  /** Ids of tools that look installed on this machine. */
  detectInstalled(resolver: ExecutableResolver): string[] {
    return this.all()
      .filter((t) => t.isInstalled(resolver, this.paths))
      .map((t) => t.id);
  }

  private readDir(dir: string, source: ToolManifest["source"]): Tool[] {
    if (!existsSync(dir)) return [];
    const out: Tool[] = [];
    for (const name of readdirSync(dir)) {
      if (name.startsWith("_")) continue;
      const file = path.join(dir, name, "tool.json");
      const manifest = this.writer.readJson<ToolManifest>(file);
      if (!manifest) continue;
      const errors = SchemaValidator.validate("tool", manifest);
      if (errors.length) {
        throw new WirebayError(`Invalid tool manifest ${file}:\n  ${errors.join("\n  ")}`, { hint: "Fix the manifest (see schemas/tool.schema.json) or remove it." });
      }
      out.push(new Tool({ ...manifest, source }));
    }
    return out;
  }
}
