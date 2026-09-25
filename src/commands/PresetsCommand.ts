/**
 * `wirebay presets [search]`
 * @module
 */

import type { AppContext } from "../app/AppContext.ts";
import type { ParsedCommand } from "../cli/CommandParser.ts";
import { ToolDirectory } from "../core/directory/ToolDirectory.ts";
import { ExitCode } from "../core/errors.ts";
import { Command } from "./Command.ts";
import { ToolsCommand } from "./ToolsCommand.ts";

/** Lists built-in servers grouped by category; a search word matches name, description or category. */
export class PresetsCommand extends Command {
  readonly name = "presets";
  override readonly aliases = ["catalog"];
  readonly help = {
    usage: "wirebay presets [search] [--stale]",
    summary: "Built-in servers you can add by name, grouped by category.",
    examples: ["wirebay presets", "wirebay presets database", "wirebay presets --stale"],
  };

  run(input: ParsedCommand, ctx: AppContext): number {
    const t = ctx.terminal;
    const config = ctx.config.load();
    const stale = ToolsCommand.staleDays(input);
    const search = input.rest.join(" ").toLowerCase();
    const rows = [...ctx.servers.presets().values()]
      .map((def) => ({
        name: def.name,
        category: def.category,
        description: def.description,
        auth: def.authLabel(),
        added: !!config.servers[def.name],
        status: def.status,
        lastVerified: def.data.lastVerified ?? null,
        ageDays: ToolDirectory.daysSince(def.data.lastVerified),
        guide: def.guide ?? null,
      }))
      .filter((r) => stale === undefined || r.ageDays > stale)
      .filter((r) => !search || `${r.name} ${r.category} ${r.description}`.toLowerCase().includes(search))
      .sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));
    if (input.flags.json) {
      t.json(rows.map((r) => ({ ...r, ageDays: Number.isFinite(r.ageDays) ? r.ageDays : null })));
      return ExitCode.Ok;
    }
    if (!rows.length) {
      t.out(`No preset matches "${search}". Any server works with: wirebay add <name> --npx <package> (or --uvx, --docker, --url)`);
      return ExitCode.Ok;
    }
    t.out(
      t.table(
        ["CATEGORY", "PRESET", "AUTH", "ADDED", "DESCRIPTION"],
        rows.map((r) => [t.dim(r.category), r.name, r.auth, r.added ? t.ok("yes") : t.dim("no"), r.description]),
      ),
    );
    t.out(
      t.dim(
        "\nAdd one: wirebay add <preset> to all   ·   search: wirebay presets <word>   ·   anything else: wirebay add <name> --npx <package>",
      ),
    );
    return ExitCode.Ok;
  }
}
