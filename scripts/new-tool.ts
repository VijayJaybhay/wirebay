// Scaffold a new tool in the tools directory.
//   npm run new:tool -- windsurf
//   npm run new:tool -- windsurf --name "Windsurf" --path "~/.codeium/windsurf/mcp_config.json"
// Creates tools/<id>/tool.json and GUIDE.md from the templates. Then fill them in and run
// `npm run gen:docs && npm run validate`.

import { cpSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import { packageRoot } from "../src/core/paths.ts";

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: { name: { type: "string" }, path: { type: "string" }, format: { type: "string" }, "root-key": { type: "string" } },
});
const id = positionals[0];
if (!id || !/^[a-z0-9][a-z0-9-]*$/.test(id)) {
  console.error("Usage: npm run new:tool -- <id> [--name \"Display Name\"] [--path \"~/.tool/mcp.json\"] [--format json|jsonc|toml|yaml] [--root-key mcpServers]");
  process.exit(2);
}
const dir = path.join(packageRoot, "tools", id);
if (existsSync(dir)) {
  console.error(`tools/${id} already exists.`);
  process.exit(1);
}
cpSync(path.join(packageRoot, "tools", "_template"), dir, { recursive: true });

const manifestFile = path.join(dir, "tool.json");
const manifest = JSON.parse(readFileSync(manifestFile, "utf8"));
manifest.id = id;
manifest.name = values.name ?? id.replace(/(^|-)(\w)/g, (_m, sep: string, ch: string) => (sep ? " " : "") + ch.toUpperCase());
manifest.detect = { commands: [id], paths: [`~/.${id}`] };
if (values.path) manifest.configs = { user: { path: values.path, createIfMissing: true } };
else manifest.configs = { user: { path: `~/.${id}/mcp.json`, createIfMissing: true } };
if (values.format) manifest.format = values.format;
if (values["root-key"]) manifest.rootKey = values["root-key"];
manifest.lastVerified = new Date().toISOString().slice(0, 10);
writeFileSync(manifestFile, JSON.stringify(manifest, null, 2) + "\n");

const guideFile = path.join(dir, "GUIDE.md");
writeFileSync(guideFile, readFileSync(guideFile, "utf8").replaceAll("My Tool", manifest.name).replaceAll("my-tool", id));

console.log(`Created tools/${id}/ (tool.json, GUIDE.md).

Next:
  1. Fill in tools/${id}/tool.json from the tool's official MCP docs
     (config path per OS and scope, format, rootKey, entry shape). Schema: schemas/tool.schema.json
  2. Fill in tools/${id}/GUIDE.md
  3. npm run gen:docs      # renders tools/${id}/examples/ and updates tables
  4. npm run validate && npm test
  5. Try it: node src/cli.ts sync to ${id} --dry-run
Guide: docs/contributing/add-a-tool.md`);
