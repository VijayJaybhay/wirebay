/**
 * Regenerates everything derived from data, so docs never drift from the code:
 * - `tools/<id>/examples/<scope>.<ext>`: what wirebay writes, with `{{placeholders}}`
 * - `tools/INDEX.md`: the tools directory table
 * - `docs/servers/catalog.md`: every preset
 * - README tables between `<!-- generated:… -->` markers
 * - `docs/cli-reference.md`: from the command classes and `src/cli/Grammar.ts`
 *
 * Run: `npm run gen:docs`. Check only (CI): `npm run gen:docs -- --check`.
 * @module
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import * as prettier from "prettier";
import { AppContext } from "../src/app/AppContext.ts";
import { WirebayApp } from "../src/app/WirebayApp.ts";
import { FLAGS } from "../src/cli/Grammar.ts";
import { ToolDirectory } from "../src/core/directory/ToolDirectory.ts";
import { WirebayPaths } from "../src/core/platform/WirebayPaths.ts";
import type { ServerDefinition } from "../src/core/servers/ServerDefinition.ts";
import type { Tool } from "../src/core/tools/Tool.ts";
import type { Launch } from "../src/core/types.ts";

/** Public repository URL used for absolute links (README is also shown on npmjs.com). */
export const REPO_URL = "https://github.com/VijayJaybhay/wirebay";

/** Writes (or, in check mode, compares) every generated file. */
export class DocsGenerator {
  private readonly check: boolean;
  private readonly ctx: AppContext;
  /** Files that differ from what would be generated (check mode). */
  readonly stale: string[] = [];

  /** @param check - Only report out-of-date files; write nothing. */
  constructor(check: boolean) {
    this.check = check;
    // Ignore any user overrides so generated files only reflect the repo.
    this.ctx = new AppContext({ env: { ...process.env, WIREBAY_HOME: WirebayPaths.packagePath(".no-user-home") } });
  }

  /** Generate everything. */
  async run(): Promise<void> {
    const tools = this.ctx.tools.all().filter((t) => t.manifest.source === "package");
    const presets = [...this.ctx.servers.presets().values()].sort(
      (a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name),
    );
    this.examples(tools);
    await this.write("tools/INDEX.md", ToolDirectory.indexMarkdown(tools));
    await this.write("docs/servers/catalog.md", DocsGenerator.catalog(presets));
    await this.readme(tools, presets);
    await this.write("docs/cli-reference.md", DocsGenerator.cliReference());
  }

  /**
   * Write a generated file. Markdown goes through Prettier with the repo's config, so generated
   * docs are formatted exactly like hand-written ones. Examples are written byte for byte.
   */
  private async write(file: string, raw: string): Promise<void> {
    const abs = WirebayPaths.packagePath(file);
    const content = file.endsWith(".md") ? await prettier.format(raw, { ...(await prettier.resolveConfig(abs)), filepath: abs }) : raw;
    this.compareAndWrite(file, abs, content);
  }

  private compareAndWrite(file: string, abs: string, content: string): void {
    const current = existsSync(abs) ? readFileSync(abs, "utf8").replace(/\r\n/g, "\n") : undefined;
    if (current === content) return;
    if (this.check) {
      this.stale.push(file);
      return;
    }
    mkdirSync(path.dirname(abs), { recursive: true });
    writeFileSync(abs, content);
    console.log(`wrote ${file}`);
  }

  private examples(tools: Tool[]): void {
    const directory = new ToolDirectory(this.ctx.adapters);
    for (const tool of tools) {
      for (const scope of tool.scopes)
        this.writeExample(`tools/${tool.id}/examples/${ToolDirectory.exampleFileName(tool, scope)}`, directory.renderExample(tool, scope));
    }
  }

  private writeExample(file: string, content: string): void {
    this.compareAndWrite(file, WirebayPaths.packagePath(file), content);
  }

  private async readme(tools: Tool[], presets: ServerDefinition[]): Promise<void> {
    const file = WirebayPaths.packagePath("README.md");
    if (!existsSync(file)) return;
    let readme = readFileSync(file, "utf8").replace(/\r\n/g, "\n");
    const serverRows = presets.map(
      (p) =>
        `| ${p.category} | **${p.name}** | ${p.description} | ${p.authLabel()} | [guide](${REPO_URL}/blob/main/${p.guide ?? "docs/servers/README.md"}) |`,
    );
    readme = DocsGenerator.replaceBetween(
      readme,
      "servers",
      ["| Category | Server | What it does | Auth | Guide |", "|---|---|---|---|---|", ...serverRows].join("\n"),
    );
    const toolRows = tools.map(
      (t) =>
        `| **${t.name}** | ${t.names.map((n) => `\`${n}\``).join(" ")} | ${t.scopes.join(", ")} | ${t.manifest.lastVerified ?? ""} | [guide](${REPO_URL}/blob/main/tools/${t.id}/GUIDE.md) |`,
    );
    readme = DocsGenerator.replaceBetween(
      readme,
      "tools",
      ["| Tool | Name in commands | Scopes | Last verified | Guide |", "|---|---|---|---|---|", ...toolRows].join("\n"),
    );
    await this.write("README.md", readme);
  }

  private static replaceBetween(text: string, marker: string, content: string): string {
    const start = `<!-- generated:${marker} -->`;
    const end = `<!-- /generated:${marker} -->`;
    const i = text.indexOf(start);
    const j = text.indexOf(end);
    if (i < 0 || j < i) return text;
    return text.slice(0, i + start.length) + "\n" + content.trim() + "\n" + text.slice(j);
  }

  private static launchSummary(launch: Launch): string {
    if (launch.type === "remote") {
      const auth =
        launch.auth?.type === "oauth"
          ? "browser sign-in"
          : launch.auth && "secret" in launch.auth
            ? `\`${launch.auth.secret}\``
            : "no auth";
      return `hosted server \`${launch.url}\` (${auth}), bridged with mcp-remote`;
    }
    const args = (launch.args ?? []).map((a) => (typeof a === "string" ? a : `[${a.optional.join(" ")}]`));
    return `\`${[launch.command, ...args].join(" ")}\``;
  }

  /** Markdown for `docs/servers/catalog.md`. */
  static catalog(presets: ServerDefinition[]): string {
    const out = [
      "# Server catalog",
      "",
      "<!-- Generated by `npm run gen:docs` from presets/*.json. Do not edit by hand. -->",
      "",
      "Every built-in server, grouped by category. Add one with `wirebay add <name> to <tools>`.",
      "Servers marked *browser sign-in* open a login page the first time a tool starts them.",
      "Some presets have their own detailed guide: [GitHub](github.md), [Netlify](netlify.md), [Firebase](firebase.md), [AWS](aws.md).",
      "Anything not listed works too: see [custom servers](custom-servers.md).",
      "",
      "| Category | Servers |",
      "|---|---|",
    ];
    const byCategory = new Map<string, ServerDefinition[]>();
    for (const p of presets) byCategory.set(p.category, [...(byCategory.get(p.category) ?? []), p]);
    for (const [cat, list] of byCategory) out.push(`| ${cat} | ${list.map((p) => `[${p.name}](#${p.name})`).join(" · ")} |`);
    out.push("");
    for (const p of presets) {
      const d = p.data;
      out.push(`## ${p.name}`, "", p.description, "");
      out.push(
        `**Category:** ${p.category} · **Status:** ${p.status} · **Auth:** ${p.authLabel()} · **Verified:** ${d.lastVerified ?? "never"}${d.docs ? ` · [Official docs](${d.docs})` : ""}`,
        "",
      );
      out.push("```bash", `wirebay add ${p.name} to all`, "```", "");
      out.push(`- **Runs:** ${DocsGenerator.launchSummary(d.launch)}`);
      for (const [name, v] of Object.entries(d.variants ?? {})) out.push(`- **\`--variant ${name}\`:** ${DocsGenerator.launchSummary(v)}`);
      if (d.prereqs?.length) out.push(`- **Needs:** ${d.prereqs.join(", ")}`);
      out.push("");
      if (p.secrets.length) {
        out.push("| Key | Required | What it is | Where to get it |", "|---|---|---|---|");
        for (const s of p.secrets)
          out.push(`| \`${s.key}\` | ${s.required ? "yes" : "no"} | ${s.description ?? ""} | ${s.help ? `[link](${s.help})` : ""} |`);
        out.push("", "Set with `wirebay secrets set <KEY>`.", "");
      }
      for (const n of d.notes ?? []) out.push(`> ${n}`, ">");
      if (d.notes?.length) out.pop();
      out.push("");
    }
    return out.join("\n").replace(/\n{3,}/g, "\n\n");
  }

  /** Markdown for `docs/cli-reference.md`, from the registered commands. */
  static cliReference(): string {
    const lines = [
      "# CLI reference",
      "",
      "<!-- Generated by `npm run gen:docs` from the command classes in src/commands/ and src/cli/Grammar.ts. Do not edit by hand. -->",
      "",
      "Every command also accepts natural phrasing; see [command grammar](command-grammar.md).",
      "",
    ];
    for (const c of WirebayApp.createRegistry()
      .all()
      .filter((x) => !x.hidden)) {
      lines.push(`## \`${c.name}\``, "", c.help.summary, "", "```", c.help.usage, "```", "");
      if (c.aliases.length) lines.push(`Aliases: ${c.aliases.map((a) => `\`${a}\``).join(", ")}`, "");
      lines.push("Examples:", "", "```bash", ...c.help.examples, "```", "");
    }
    lines.push("## Options", "", "| Option | Description |", "|---|---|");
    for (const f of FLAGS)
      lines.push(`| \`--${f.name}${f.value ? " <value>" : ""}\`${f.short ? ` / \`-${f.short}\`` : ""} | ${f.description} |`);
    lines.push(
      "",
      "## Exit codes",
      "",
      "| Code | Meaning |",
      "|---|---|",
      "| 0 | Success |",
      "| 1 | Error |",
      "| 2 | Usage error (unknown command, missing argument) |",
      "| 3 | `doctor` found problems |",
      "| 4 | Conflict or hand-edited entry; re-run with `--force` to overwrite |",
      "",
    );
    return lines.join("\n");
  }
}

const generator = new DocsGenerator(process.argv.includes("--check"));
await generator.run();
if (generator.stale.length) {
  console.error(`Generated files are out of date:\n  ${generator.stale.join("\n  ")}\nRun: npm run gen:docs`);
  process.exit(1);
}
if (process.argv.includes("--check")) console.log("Generated files are up to date.");
