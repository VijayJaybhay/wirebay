/**
 * `wirebay restore <tool> [--list | <backup-id>]`
 * @module
 */

import type { AppContext } from "../app/AppContext.ts";
import type { ParsedCommand } from "../cli/CommandParser.ts";
import { ExitCode, UsageError } from "../core/errors.ts";
import { Command } from "./Command.ts";

/** Rolls a tool's config file back to a backup (the current file is backed up first). */
export class RestoreCommand extends Command {
  readonly name = "restore";
  override readonly targeted = true;
  override readonly acceptsFreeWords = true;
  readonly help = {
    usage: "wirebay restore <tool> [--list | <backup-id>]",
    summary: "Roll a tool's config back to a backup.",
    examples: ["wirebay restore codex --list", "wirebay restore codex"],
  };

  async run(input: ParsedCommand, ctx: AppContext): Promise<number> {
    const t = ctx.terminal;
    const tool = Array.isArray(input.tools) ? input.tools[0] : undefined;
    if (!tool) throw new UsageError("Which tool?", "Example: wirebay restore codex --list");
    const backups = ctx.backups.list(tool);
    if (input.flags.list || !backups.length) {
      if (input.flags.json) t.json(backups);
      else if (!backups.length) t.out(`No backups for ${tool} yet.`);
      else
        t.out(
          t.table(
            ["BACKUP ID", "FILE"],
            backups.map((b) => [b.createdAt, b.originalPath]),
          ),
        );
      return ExitCode.Ok;
    }
    const [wanted] = input.rest;
    const backup = wanted === undefined ? backups[0] : backups.find((b) => b.id.startsWith(wanted));
    if (!backup) throw new UsageError(`No backup "${wanted ?? "latest"}" for ${tool}.`, `See them with: wirebay restore ${tool} --list`);
    if (!(await t.confirm(`Restore ${backup.originalPath} from ${backup.createdAt}?`, input.flags))) {
      t.out(t.dim("Cancelled. Pass --yes to skip this question."));
      return ExitCode.Error;
    }
    const safety = ctx.backups.restore(backup);
    t.out(`${t.ok("✓")} restored ${backup.originalPath}`);
    if (safety) t.out(t.dim(`  the version you just replaced is saved as ${safety}`));
    t.out(t.dim("  Run `wirebay list` to see what is in sync now."));
    return ExitCode.Ok;
  }
}
