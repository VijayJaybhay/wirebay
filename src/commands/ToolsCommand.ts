/**
 * `wirebay tools [--stale] | tools verify [id] | tools index`
 * @module
 */

import { existsSync, writeFileSync } from "node:fs";
import type { AppContext } from "../app/AppContext.ts";
import type { ParsedCommand } from "../cli/CommandParser.ts";
import { ToolDirectory } from "../core/directory/ToolDirectory.ts";
import { ExitCode, UsageError } from "../core/errors.ts";
import { WirebayPaths } from "../core/platform/WirebayPaths.ts";
import { Command } from "./Command.ts";

/** Lists supported tools, verifies manifests, and regenerates the tools index. */
export class ToolsCommand extends Command {
  readonly name = "tools";
  override readonly aliases = ["clients"];
  readonly help = {
    usage: "wirebay tools [--stale [--days N]] | tools verify [id] | tools index",
    summary: "Supported AI tools, whether they are installed, and where their config lives.",
    examples: ["wirebay tools", "wirebay tools --stale", "wirebay tools verify codex"],
  };

  run(input: ParsedCommand, ctx: AppContext): number {
    const [sub, id] = input.rest;
    if (sub === "verify") return this.verify(id, input, ctx);
    if (sub === "index") return this.writeIndex(ctx);
    if (sub) throw new UsageError(`Unknown tools command "${sub}".`, "Use: wirebay tools [--stale] | tools verify <id> | tools index");
    return this.list(input, ctx);
  }

  private list(input: ParsedCommand, ctx: AppContext): number {
    const t = ctx.terminal;
    const stale = ToolsCommand.staleDays(input);
    const rows = ctx.tools
      .all()
      .map((tool) => ({
        id: tool.id,
        name: tool.name,
        aliases: tool.aliases,
        installed: tool.isInstalled(ctx.resolver, ctx.paths),
        userConfig: tool.configPath("user", ctx.paths, ctx.cwd) ?? null,
        scopes: tool.scopes,
        status: tool.status,
        lastVerified: tool.manifest.lastVerified ?? null,
        ageDays: ToolDirectory.daysSince(tool.manifest.lastVerified),
        source: tool.manifest.source,
      }))
      .filter((r) => stale === undefined || r.ageDays > stale);
    if (input.flags.json) {
      t.json(rows.map((r) => ({ ...r, ageDays: Number.isFinite(r.ageDays) ? r.ageDays : null })));
      return ExitCode.Ok;
    }
    t.out(
      t.table(
        ["TOOL", "ALIASES", "INSTALLED", "STATUS", "VERIFIED", "USER CONFIG"],
        rows.map((r) => [
          r.id,
          r.aliases.join(", "),
          r.installed ? t.ok("yes") : t.dim("no"),
          r.status,
          r.ageDays > 90 ? t.warn(r.lastVerified ?? "never") : (r.lastVerified ?? ""),
          t.dim(r.userConfig ?? `- (${r.scopes.join(", ")} only)`),
        ]),
      ),
    );
    if (stale !== undefined) t.out(t.dim(`\n${String(rows.length)} tool(s) not verified in the last ${String(stale)} days.`));
    return ExitCode.Ok;
  }

  private verify(id: string | undefined, input: ParsedCommand, ctx: AppContext): number {
    const t = ctx.terminal;
    const directory = new ToolDirectory(ctx.adapters);
    const results = (id ? [ctx.tools.get(id)] : ctx.tools.all()).map((tool) => directory.verify(tool));
    if (input.flags.json) {
      t.json(results);
      return results.some((r) => !r.ok) ? ExitCode.Error : ExitCode.Ok;
    }
    for (const r of results) {
      t.out(`${r.ok ? t.ok("✓") : t.err("✗")} ${t.bold(r.tool)}`);
      for (const check of r.checks)
        t.out(`    ${check.ok ? t.ok("✓") : t.err("✗")} ${check.name}${check.detail ? t.dim(`: ${check.detail}`) : ""}`);
    }
    return results.some((r) => !r.ok) ? ExitCode.Error : ExitCode.Ok;
  }

  private writeIndex(ctx: AppContext): number {
    if (!existsSync(WirebayPaths.packagePath("scripts")))
      throw new UsageError("`tools index` is for contributors working in a clone of the wirebay repo.");
    const file = WirebayPaths.packagePath("tools", "INDEX.md");
    writeFileSync(file, ToolDirectory.indexMarkdown(ctx.tools.all().filter((x) => x.manifest.source === "package")));
    ctx.terminal.out(`${ctx.terminal.ok("✓")} wrote ${file}`);
    return ExitCode.Ok;
  }

  /** The `--stale [--days N]` threshold, or `undefined` without `--stale`. */
  static staleDays(input: ParsedCommand): number | undefined {
    if (!input.flags.stale) return undefined;
    const d = Number(input.flags.days ?? 90);
    if (!Number.isFinite(d) || d < 0) throw new UsageError("--days must be a number.");
    return d;
  }
}
