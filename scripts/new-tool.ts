/**
 * Scaffold a new tool in the tools directory.
 *
 *     npm run new:tool -- windsurf
 *     npm run new:tool -- windsurf --name "Windsurf" --path "~/.codeium/windsurf/mcp_config.json"
 *
 * Creates `tools/<id>/tool.json` and `GUIDE.md` from `tools/_template/`.
 * Then fill them in and run `npm run gen:docs && npm run validate`.
 * @module
 */

import { cpSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import { WirebayPaths } from "../src/core/platform/WirebayPaths.ts";
import type { ToolManifest } from "../src/core/types.ts";

/** Options for {@link ToolScaffolder}. */
export interface ToolScaffoldOptions {
  id: string;
  name?: string;
  path?: string;
  format?: ToolManifest["format"];
  rootKey?: string;
}

/** Creates a new tool folder from the template. */
export class ToolScaffolder {
  private readonly options: ToolScaffoldOptions;

  constructor(options: ToolScaffoldOptions) {
    this.options = options;
  }

  /** Folder the tool will live in. */
  get folder(): string {
    return WirebayPaths.packagePath("tools", this.options.id);
  }

  /** Create the files. Returns false when the tool already exists. */
  create(): boolean {
    if (existsSync(this.folder)) return false;
    cpSync(WirebayPaths.packagePath("tools", "_template"), this.folder, { recursive: true });
    this.writeManifest();
    this.writeGuide();
    return true;
  }

  /** A display name derived from the id (`kilo-code` → `Kilo Code`). */
  displayName(): string {
    return this.options.name ?? this.options.id.replace(/(^|-)(\w)/g, (_m, sep: string, ch: string) => (sep ? " " : "") + ch.toUpperCase());
  }

  private writeManifest(): void {
    const { id, path: configPath, format, rootKey } = this.options;
    const file = path.join(this.folder, "tool.json");
    const manifest = JSON.parse(readFileSync(file, "utf8")) as ToolManifest;
    manifest.id = id;
    manifest.name = this.displayName();
    manifest.detect = { commands: [id], paths: [`~/.${id}`] };
    manifest.configs = { user: { path: configPath ?? `~/.${id}/mcp.json`, createIfMissing: true } };
    if (format) manifest.format = format;
    if (rootKey) manifest.rootKey = rootKey;
    manifest.lastVerified = new Date().toISOString().slice(0, 10);
    writeFileSync(file, JSON.stringify(manifest, null, 2) + "\n");
  }

  private writeGuide(): void {
    const file = path.join(this.folder, "GUIDE.md");
    writeFileSync(file, readFileSync(file, "utf8").replaceAll("My Tool", this.displayName()).replaceAll("my-tool", this.options.id));
  }
}

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: { name: { type: "string" }, path: { type: "string" }, format: { type: "string" }, "root-key": { type: "string" } },
});
const id = positionals[0];
if (!id || !/^[a-z0-9][a-z0-9-]*$/.test(id)) {
  console.error('Usage: npm run new:tool -- <id> [--name "Display Name"] [--path "~/.tool/mcp.json"] [--format json|jsonc|toml|yaml] [--root-key mcpServers]');
  process.exit(2);
}
const scaffolder = new ToolScaffolder({ id, name: values.name, path: values.path, format: values.format as ToolManifest["format"], rootKey: values["root-key"] });
if (!scaffolder.create()) {
  console.error(`tools/${id} already exists.`);
  process.exit(1);
}
console.log(`Created tools/${id}/ (tool.json, GUIDE.md).

Next:
  1. Fill in tools/${id}/tool.json from the tool's official MCP docs
     (config path per OS and scope, format, rootKey, entry shape). Schema: schemas/tool.schema.json
  2. Fill in tools/${id}/GUIDE.md
  3. npm run gen:docs      # renders tools/${id}/examples/ and updates tables
  4. npm run validate && npm test
  5. Try it: node src/cli.ts sync to ${id} --dry-run
Guide: docs/contributing/add-a-tool.md`);
