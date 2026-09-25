/**
 * Scaffold a new built-in server preset.
 *
 *     npm run new:server -- linear --npx @linear/mcp-server@1.2.3 --secret LINEAR_API_KEY --category productivity
 *     npm run new:server -- acme --url https://mcp.acme.dev/mcp            # browser sign-in
 *     npm run new:server -- acme --url https://mcp.acme.dev/mcp --secret ACME_TOKEN --guide
 *
 * Creates `presets/<name>.json`. Its docs appear in the generated server catalog; `--guide` also
 * creates a dedicated `docs/servers/<name>.md` from the template.
 * @module
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { WirebayPaths } from "../src/core/platform/WirebayPaths.ts";
import type { ServerCategory, ServerDef } from "../src/core/types.ts";

/** Options for {@link ServerScaffolder}. */
export interface ServerScaffoldOptions {
  name: string;
  npx?: string;
  uvx?: string;
  url?: string;
  secrets: string[];
  description?: string;
  category?: ServerCategory;
  /** Also create a dedicated guide page. */
  guide?: boolean;
}

/** Creates a preset from the template. */
export class ServerScaffolder {
  private readonly options: ServerScaffoldOptions;

  constructor(options: ServerScaffoldOptions) {
    this.options = options;
  }

  /** Path of the preset file. */
  get presetFile(): string {
    return WirebayPaths.packagePath("presets", `${this.options.name}.json`);
  }

  /** Create the files. Returns false when the preset already exists. */
  create(): boolean {
    if (existsSync(this.presetFile)) return false;
    writeFileSync(this.presetFile, JSON.stringify(this.definition(), null, 2) + "\n");
    if (this.options.guide) this.writeGuide();
    return true;
  }

  /** The new definition, starting from `presets/_template.json`. */
  definition(): ServerDef {
    const o = this.options;
    const def = JSON.parse(readFileSync(WirebayPaths.packagePath("presets", "_template.json"), "utf8")) as ServerDef;
    def.name = o.name;
    def.description = o.description ?? def.description;
    def.category = o.category ?? def.category;
    if (o.npx) def.launch = { type: "stdio", command: "npx", args: ["-y", o.npx] };
    else if (o.uvx) {
      def.launch = { type: "stdio", command: "uvx", args: [o.uvx] };
      def.prereqs = ["uvx"];
    } else if (o.url) {
      def.launch = { type: "remote", url: o.url, auth: o.secrets[0] ? { type: "bearer", secret: o.secrets[0] } : { type: "oauth" } };
    }
    def.secrets = o.secrets.map((key) => ({ key, required: true, description: "TODO: what this is and where to create it" }));
    def.guide = o.guide ? `docs/servers/${o.name}.md` : `docs/servers/catalog.md#${o.name}`;
    def.notes = ["TODO: risk notes (can it write/delete/spend?) and setup tips"];
    def.lastVerified = new Date().toISOString().slice(0, 10);
    return def;
  }

  private writeGuide(): void {
    const file = WirebayPaths.packagePath("docs", "servers", `${this.options.name}.md`);
    if (existsSync(file)) return;
    const template = readFileSync(WirebayPaths.packagePath("templates", "server-guide.md"), "utf8");
    writeFileSync(
      file,
      template.replaceAll("{{name}}", this.options.name).replaceAll("{{KEY}}", this.options.secrets[0] ?? "MY_SERVER_TOKEN"),
    );
  }
}

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: {
    npx: { type: "string" },
    uvx: { type: "string" },
    url: { type: "string" },
    secret: { type: "string", multiple: true },
    description: { type: "string" },
    category: { type: "string" },
    guide: { type: "boolean" },
  },
});
const name = positionals[0];
if (!name || !/^[a-z0-9][a-z0-9-]*$/.test(name)) {
  console.error(
    'Usage: npm run new:server -- <name> [--npx pkg@version | --uvx pkg@version | --url https://…] [--secret KEY]… [--category dev-tools] [--description "…"] [--guide]',
  );
  process.exit(2);
}
const scaffolder = new ServerScaffolder({
  name,
  npx: values.npx,
  uvx: values.uvx,
  url: values.url,
  secrets: values.secret ?? [],
  description: values.description,
  category: values.category as ServerCategory | undefined,
  guide: values.guide,
});
if (!scaffolder.create()) {
  console.error(`presets/${name}.json already exists.`);
  process.exit(1);
}
console.log(`Created presets/${name}.json${values.guide ? ` and docs/servers/${name}.md` : ""}.

Next:
  1. Fill in presets/${name}.json: pin the version, describe every secret, add risk notes.
     Schema: schemas/server.schema.json
  2. npm run gen:docs      # adds it to the server catalog and README
  3. npm run validate && npm test
  4. Try it: node src/cli.ts add ${name} to <tool> && node src/cli.ts doctor ${name}
Guide: docs/contributing/add-a-server.md`);
