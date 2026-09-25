// Scaffold a new built-in server preset.
//   npm run new:server -- linear --npx @linear/mcp-server@1.2.3 --secret LINEAR_API_KEY
// Creates presets/<name>.json, docs/servers/<name>.md and a section in templates/secrets.env.example.
// Then fill them in and run `npm run gen:docs && npm run validate`.

import { appendFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import { packageRoot } from "../src/core/paths.ts";
import type { ServerDef } from "../src/core/types.ts";

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: {
    npx: { type: "string" },
    uvx: { type: "string" },
    url: { type: "string" },
    secret: { type: "string", multiple: true },
    description: { type: "string" },
  },
});
const name = positionals[0];
if (!name || !/^[a-z0-9][a-z0-9-]*$/.test(name)) {
  console.error("Usage: npm run new:server -- <name> [--npx pkg@version | --uvx pkg@version | --url https://…] [--secret KEY]… [--description \"…\"]");
  process.exit(2);
}
const presetFile = path.join(packageRoot, "presets", `${name}.json`);
if (existsSync(presetFile)) {
  console.error(`presets/${name}.json already exists.`);
  process.exit(1);
}

const def = JSON.parse(readFileSync(path.join(packageRoot, "presets", "_template.json"), "utf8")) as ServerDef;
def.name = name;
def.description = values.description ?? def.description;
if (values.npx) def.launch = { type: "stdio", command: "npx", args: ["-y", values.npx] };
else if (values.uvx) {
  def.launch = { type: "stdio", command: "uvx", args: [values.uvx] };
  def.prereqs = ["uvx"];
} else if (values.url) {
  def.launch = { type: "remote", url: values.url, auth: values.secret?.[0] ? { type: "bearer", secret: values.secret[0] } : { type: "oauth" } };
}
def.secrets = (values.secret ?? ["MY_SERVER_TOKEN"]).map((key) => ({
  key,
  required: true,
  description: "TODO: what this is and where to create it",
  help: `https://github.com/VijayJaybhay/wirebay/blob/main/docs/servers/${name}.md#1-create-a-token`,
}));
def.guide = `docs/servers/${name}.md`;
def.lastVerified = new Date().toISOString().slice(0, 10);
writeFileSync(presetFile, JSON.stringify(def, null, 2) + "\n");

const guideFile = path.join(packageRoot, "docs", "servers", `${name}.md`);
if (!existsSync(guideFile)) {
  const tpl = readFileSync(path.join(packageRoot, "templates", "server-guide.md"), "utf8");
  writeFileSync(guideFile, tpl.replaceAll("{{name}}", name).replaceAll("{{KEY}}", def.secrets[0]?.key ?? "MY_SERVER_TOKEN"));
}

const lines = [`\n# ── ${name} ── https://github.com/VijayJaybhay/wirebay/blob/main/docs/servers/${name}.md`];
for (const s of def.secrets) lines.push(`# ${s.description}`, `${s.key}=`);
appendFileSync(path.join(packageRoot, "templates", "secrets.env.example"), lines.join("\n") + "\n");

console.log(`Created presets/${name}.json, docs/servers/${name}.md and a section in templates/secrets.env.example.

Next:
  1. Fill in presets/${name}.json (pin the package version; schema: schemas/server.schema.json)
  2. Write docs/servers/${name}.md
  3. npm run gen:docs && npm run validate && npm test
  4. Try it: node src/cli.ts add ${name} to <tool> && node src/cli.ts doctor ${name}
Guide: docs/contributing/add-a-server.md`);
