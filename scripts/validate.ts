/**
 * Checks every contribution-facing data file. Run: `npm run validate`.
 * - `tools/*\/tool.json`: schema, folder = id, unique ids/aliases, GUIDE.md and examples exist
 * - `presets/*.json`: schema, file name = name, category, guide exists, pinned versions,
 *   no real-looking tokens, every required key explained (a description and how to get it)
 * - `templates/secrets.env.example`: no real-looking tokens
 * - generated files are up to date
 * @module
 */

import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { ToolDirectory } from "../src/core/directory/ToolDirectory.ts";
import { WirebayPaths } from "../src/core/platform/WirebayPaths.ts";
import { SchemaValidator } from "../src/core/schema/SchemaValidator.ts";
import { ServerDefinition } from "../src/core/servers/ServerDefinition.ts";
import { RESERVED_WORDS } from "../src/core/servers/ServerRegistry.ts";
import { Tool } from "../src/core/tools/Tool.ts";
import type { ServerDef, ToolManifest } from "../src/core/types.ts";

/** Collects problems across the repository's data files. */
export class RepoValidator {
  /** Values that look like real credentials; they must never be committed. */
  static readonly secretLike =
    /\b(ghp_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|nfp_[A-Za-z0-9]{20,}|AKIA[0-9A-Z]{16}|sk-[A-Za-z0-9]{20,}|xox[bap]-[A-Za-z0-9-]{10,})\b/;

  readonly errors: string[] = [];
  private readonly toolNames = new Map<string, string>();
  private toolCount = 0;
  private presetCount = 0;
  private readonly validator = new SchemaValidator();

  /** Run every check. */
  run(): void {
    this.checkTools();
    this.checkPresets();
    this.checkTemplate();
    this.checkGenerated();
  }

  /** One-line summary for success. */
  summary(): string {
    return `✓ ${String(this.toolCount)} tools and ${String(this.presetCount)} presets are valid; generated files are up to date.`;
  }

  private fail(file: string, message: string): void {
    this.errors.push(`${file}: ${message}`);
  }

  private rel(p: string): string {
    return path.relative(WirebayPaths.packageRoot, p).replace(/\\/g, "/");
  }

  private readJson(file: string): unknown {
    try {
      return JSON.parse(readFileSync(file, "utf8")) as unknown;
    } catch (err) {
      this.fail(this.rel(file), `not valid JSON (${(err as Error).message})`);
      return undefined;
    }
  }

  private checkTools(): void {
    const dir = WirebayPaths.packagePath("tools");
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (!entry.isDirectory() || entry.name.startsWith("_")) continue;
      const file = path.join(dir, entry.name, "tool.json");
      if (!existsSync(file)) {
        this.fail(this.rel(path.join(dir, entry.name)), "missing tool.json");
        continue;
      }
      const manifest = this.readJson(file) as ToolManifest | undefined;
      if (!manifest) continue;
      for (const e of this.validator.validate("tool", manifest)) this.fail(this.rel(file), e);
      if (manifest.id !== entry.name) this.fail(this.rel(file), `id "${manifest.id}" must match its folder name "${entry.name}"`);
      const tool = new Tool(manifest);
      for (const name of tool.names) {
        if (this.toolNames.has(name))
          this.fail(this.rel(file), `name/alias "${name}" is already used by ${this.toolNames.get(name) ?? "?"}`);
        if (RESERVED_WORDS.has(name)) this.fail(this.rel(file), `"${name}" is a reserved word`);
        this.toolNames.set(name, tool.id);
      }
      if (!existsSync(path.join(dir, entry.name, "GUIDE.md"))) this.fail(this.rel(file), "missing GUIDE.md next to it");
      for (const scope of tool.scopes) {
        const example = path.join(dir, entry.name, "examples", ToolDirectory.exampleFileName(tool, scope));
        if (!existsSync(example)) this.fail(this.rel(example), "missing (run `npm run gen:docs`)");
      }
      this.toolCount++;
    }
  }

  private checkPresets(): void {
    const dir = WirebayPaths.packagePath("presets");
    for (const f of readdirSync(dir).filter((x) => x.endsWith(".json") && !x.startsWith("_"))) {
      const file = path.join(dir, f);
      const where = this.rel(file);
      if (RepoValidator.secretLike.test(readFileSync(file, "utf8")))
        this.fail(where, "contains something that looks like a real token. Presets hold key NAMES only");
      const data = this.readJson(file) as ServerDef | undefined;
      if (!data) continue;
      for (const e of this.validator.validate("server", data)) this.fail(where, e);
      const def = new ServerDefinition(data);
      if (`${def.name}.json` !== f) this.fail(where, `name "${def.name}" must match the file name`);
      if (this.toolNames.has(def.name))
        this.fail(where, `server name "${def.name}" clashes with tool ${this.toolNames.get(def.name) ?? "?"}`);
      if (RESERVED_WORDS.has(def.name)) this.fail(where, `"${def.name}" is a reserved word`);
      if (!data.category) this.fail(where, 'missing "category"');
      if (!data.lastVerified) this.fail(where, 'missing "lastVerified"');
      if (!data.guide) this.fail(where, 'missing "guide" (path to docs/servers/<name>.md or the catalog)');
      else if (!existsSync(WirebayPaths.packagePath(data.guide.split("#")[0] ?? data.guide)))
        this.fail(where, `guide ${data.guide} does not exist`);
      if (/@latest\b/.test(JSON.stringify(data.launch) + JSON.stringify(data.variants ?? {})))
        this.fail(where, "pin package versions instead of @latest");
      for (const key of def.requiredKeys()) {
        const spec = def.secretSpec(key);
        if (!spec?.description) this.fail(where, `required key ${key} needs a "description"`);
        if (!spec?.help) this.fail(where, `required key ${key} needs a "help" (how to get it: steps or a link, shown by wirebay add)`);
      }
      this.presetCount++;
    }
  }

  private checkTemplate(): void {
    const text = readFileSync(WirebayPaths.packagePath("templates", "secrets.env.example"), "utf8");
    if (RepoValidator.secretLike.test(text)) this.fail("templates/secrets.env.example", "contains something that looks like a real token");
  }

  private checkGenerated(): void {
    const r = spawnSync(process.execPath, [WirebayPaths.packagePath("scripts", "gen-docs.ts"), "--check"], { encoding: "utf8" });
    if (r.status !== 0) this.errors.push((r.stderr || r.stdout).trim());
  }
}

const validator = new RepoValidator();
validator.run();
if (validator.errors.length) {
  console.error(`✗ ${String(validator.errors.length)} problem(s):\n  ${validator.errors.join("\n  ")}`);
  process.exit(1);
}
console.log(validator.summary());
