// Checks every contribution-facing data file. Run: npm run validate
//   presets/*.json      schema, file name = name, guide exists, no secret-looking values
//   tools/*/tool.json   schema, folder = id, unique ids/aliases, GUIDE.md + examples exist
//   templates/secrets.env.example   has a line for every required preset secret
//   generated files     up to date (tools/INDEX.md, examples, README tables, CLI reference)

import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { exampleFileName } from "../src/core/directory.ts";
import { packageRoot } from "../src/core/paths.ts";
import { RESERVED_WORDS, requiredKeys } from "../src/core/servers.ts";
import type { ScopeName, ServerDef, ToolManifest } from "../src/core/types.ts";
import { validateAgainst } from "../src/core/validate.ts";

const errors: string[] = [];
const fail = (file: string, msg: string) => errors.push(`${file}: ${msg}`);
const rel = (p: string) => path.relative(packageRoot, p).replace(/\\/g, "/");
const readJson = <T>(file: string): T | undefined => {
  try {
    return JSON.parse(readFileSync(file, "utf8")) as T;
  } catch (err) {
    fail(rel(file), `not valid JSON (${(err as Error).message})`);
    return undefined;
  }
};

// Values that look like real credentials must never be committed.
const SECRET_LIKE = /\b(ghp_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|nfp_[A-Za-z0-9]{20,}|AKIA[0-9A-Z]{16}|sk-[A-Za-z0-9]{20,}|xox[bap]-[A-Za-z0-9-]{10,})\b/;

// ── tools ──
const toolsDir = path.join(packageRoot, "tools");
const toolNames = new Map<string, string>();
const tools: ToolManifest[] = [];
for (const dir of readdirSync(toolsDir, { withFileTypes: true })) {
  if (!dir.isDirectory() || dir.name.startsWith("_")) continue;
  const file = path.join(toolsDir, dir.name, "tool.json");
  if (!existsSync(file)) {
    fail(rel(path.join(toolsDir, dir.name)), "missing tool.json");
    continue;
  }
  const tool = readJson<ToolManifest>(file);
  if (!tool) continue;
  for (const e of validateAgainst("tool", tool)) fail(rel(file), e);
  if (tool.id !== dir.name) fail(rel(file), `id "${tool.id}" must match its folder name "${dir.name}"`);
  for (const name of [tool.id, ...(tool.aliases ?? [])]) {
    if (toolNames.has(name)) fail(rel(file), `name/alias "${name}" is already used by ${toolNames.get(name)}`);
    if (RESERVED_WORDS.has(name)) fail(rel(file), `"${name}" is a reserved word`);
    toolNames.set(name, tool.id);
  }
  if (!existsSync(path.join(toolsDir, dir.name, "GUIDE.md"))) fail(rel(file), "missing GUIDE.md next to it");
  for (const scope of Object.keys(tool.configs) as ScopeName[]) {
    const example = path.join(toolsDir, dir.name, "examples", exampleFileName(tool, scope));
    if (!existsSync(example)) fail(rel(example), "missing (run `npm run gen:docs`)");
  }
  tools.push(tool);
}

// ── presets ──
const presetsDir = path.join(packageRoot, "presets");
const presets: ServerDef[] = [];
for (const f of readdirSync(presetsDir).filter((x) => x.endsWith(".json") && !x.startsWith("_"))) {
  const file = path.join(presetsDir, f);
  const text = readFileSync(file, "utf8");
  if (SECRET_LIKE.test(text)) fail(rel(file), "contains something that looks like a real token. Presets hold key NAMES only");
  const def = readJson<ServerDef>(file);
  if (!def) continue;
  for (const e of validateAgainst("server", def)) fail(rel(file), e);
  if (`${def.name}.json` !== f) fail(rel(file), `name "${def.name}" must match the file name`);
  if (toolNames.has(def.name)) fail(rel(file), `server name "${def.name}" clashes with tool ${toolNames.get(def.name)}`);
  if (RESERVED_WORDS.has(def.name)) fail(rel(file), `"${def.name}" is a reserved word`);
  if (!def.guide) fail(rel(file), 'missing "guide" (path to docs/servers/<name>.md)');
  else if (!existsSync(path.join(packageRoot, def.guide.split("#")[0]!))) fail(rel(file), `guide ${def.guide} does not exist`);
  if (!def.lastVerified) fail(rel(file), 'missing "lastVerified"');
  const launchText = JSON.stringify(def.launch) + JSON.stringify(def.variants ?? {});
  if (/@latest\b/.test(launchText)) fail(rel(file), "pin package versions instead of @latest");
  presets.push(def);
}

// ── secrets template ──
const template = readFileSync(path.join(packageRoot, "templates", "secrets.env.example"), "utf8");
if (SECRET_LIKE.test(template)) fail("templates/secrets.env.example", "contains something that looks like a real token");
for (const def of presets) {
  // Every required key must be explained, so users know what to create.
  for (const key of requiredKeys(def)) {
    const spec = def.secrets?.find((s) => s.key === key);
    if (!spec?.description) fail(`presets/${def.name}.json`, `required key ${key} needs a "description"`);
  }
  if (!def.category) fail(`presets/${def.name}.json`, 'missing "category"');
}

// ── generated files ──
const gen = spawnSync(process.execPath, [path.join(packageRoot, "scripts", "gen-docs.ts"), "--check"], { encoding: "utf8" });
if (gen.status !== 0) errors.push((gen.stderr || gen.stdout).trim());

if (errors.length) {
  console.error(`✗ ${errors.length} problem(s):\n  ${errors.join("\n  ")}`);
  process.exit(1);
}
console.log(`✓ ${tools.length} tools and ${presets.length} presets are valid; generated files are up to date.`);
