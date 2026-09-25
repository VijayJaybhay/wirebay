// `wirebay restore <tool> [--list | <backup-id>]`: roll a tool's config file back to a backup.

import { copyFileSync } from "node:fs";
import type { ParsedCommand } from "../cli/parse.ts";
import { c, confirm, out, printJson, table } from "../cli/ui.ts";
import { UsageError } from "../core/errors.ts";
import { backupFile, listBackups } from "../core/io.ts";

export async function restore(cmd: ParsedCommand): Promise<number> {
  const tool = Array.isArray(cmd.tools) ? cmd.tools[0] : undefined;
  if (!tool) throw new UsageError("Which tool?", "Example: wirebay restore codex --list");
  const backups = listBackups(tool);
  if (cmd.flags.list || !backups.length) {
    if (cmd.flags.json) printJson(backups);
    else if (!backups.length) out(`No backups for ${tool} yet.`);
    else out(table(["BACKUP ID", "FILE"], backups.map((b) => [b.id.split("__")[0]!, b.originalPath])));
    return 0;
  }
  const wanted = cmd.rest[0];
  const backup = wanted ? backups.find((b) => b.id.startsWith(wanted)) : backups[0];
  if (!backup) throw new UsageError(`No backup "${wanted}" for ${tool}.`, `See them with: wirebay restore ${tool} --list`);
  if (!(await confirm(`Restore ${backup.originalPath} from ${backup.createdAt}?`, cmd.flags))) {
    out(c.dim("Cancelled. Pass --yes to skip this question."));
    return 1;
  }
  const safety = backupFile(tool, backup.originalPath);
  copyFileSync(backup.backupPath, backup.originalPath);
  out(`${c.ok("✓")} restored ${backup.originalPath}`);
  if (safety) out(c.dim(`  the version you just replaced is saved as ${safety}`));
  out(c.dim("  Run `wirebay list` to see what is in sync now."));
  return 0;
}
