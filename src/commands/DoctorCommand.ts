/**
 * `wirebay doctor [servers|tools]`
 * @module
 */

import type { AppContext } from "../app/AppContext.ts";
import type { ParsedCommand } from "../cli/CommandParser.ts";
import { Doctor, type DoctorCheck } from "../core/doctor/Doctor.ts";
import { DoctorFixer } from "../core/doctor/DoctorFixer.ts";
import { ExitCode } from "../core/errors.ts";
import { Command } from "./Command.ts";
import { SyncReporter } from "./support/SyncReporter.ts";

/** Checks prerequisites, secrets, permissions and tool files, and starts each server for a real MCP handshake. */
export class DoctorCommand extends Command {
  readonly name = "doctor";
  override readonly aliases = ["check"];
  override readonly targeted = true;
  readonly help = {
    usage: "wirebay doctor [servers|tools] [--offline] [--fix [--yes] [--dry-run]] [--json]",
    summary: "Check prerequisites, secrets, permissions, tool files, and start each server for a real MCP handshake.",
    examples: ["wirebay doctor", "wirebay doctor github", "wirebay doctor --offline", "wirebay doctor --fix"],
  };

  async run(input: ParsedCommand, ctx: AppContext): Promise<number> {
    const t = ctx.terminal;
    const json = !!input.flags.json;
    // A handshake can take a minute on first run (npx/uvx download the server), so show progress.
    const progress = json ? undefined : t.progress("Checking your setup…");
    const print = (c: DoctorCheck): void => {
      if (json) return;
      progress?.update("Checking…");
      const icon = c.status === "ok" ? t.ok("✓") : c.status === "warn" ? t.warn("!") : t.err("✗");
      t.out(`${icon} ${t.dim(c.area + ":")} ${c.name}${c.detail ? t.dim(`  ${c.detail}`) : ""}`);
      if (c.fix && c.status !== "ok") t.out(`    ${t.cyan("fix:")} ${c.fix.replace(/\n/g, "\n         ")}`);
    };
    let checks: DoctorCheck[];
    try {
      checks = await new Doctor(ctx).run({
        servers: Array.isArray(input.servers) ? input.servers : undefined,
        tools: Array.isArray(input.tools) ? input.tools : undefined,
        offline: !!input.flags.offline,
        timeoutSeconds: Number(input.flags.timeout ?? 90),
        onCheck: print,
        onStart: (server) => {
          progress?.update(`Starting ${server} for a test connection (the first run may download it)…`);
        },
      });
    } finally {
      progress?.stop();
    }
    const fails = checks.filter((c) => c.status === "fail").length;
    const warns = checks.filter((c) => c.status === "warn").length;
    const fixed = input.flags.fix ? await this.fix(checks, input, ctx) : undefined;
    if (json) t.json({ ok: fails === 0, fails, warnings: warns, checks, ...(fixed ? { fixes: fixed } : {}) });
    else
      t.out(
        fails
          ? t.err(`\n${String(fails)} problem(s), ${String(warns)} warning(s).`)
          : t.ok(`\nAll good${warns ? ` (${String(warns)} warning(s))` : ""}.`),
      );
    return fails ? ExitCode.DoctorProblems : ExitCode.Ok;
  }

  /**
   * `--fix`: list the repairs, ask (unless `--yes`), apply them (or only preview with `--dry-run`)
   * and print what changed. Only wirebay-managed entries are touched.
   */
  private async fix(checks: DoctorCheck[], input: ParsedCommand, ctx: AppContext): Promise<FixReport[]> {
    const t = ctx.terminal;
    const json = !!input.flags.json;
    const dryRun = !!input.flags["dry-run"];
    const fixes = new DoctorFixer(ctx).fixesFor(checks);
    if (!fixes.length) {
      if (!json) t.out(t.dim("\nNothing doctor can fix automatically."));
      return [];
    }
    if (!json) {
      t.out(t.bold("\nFixes:"));
      for (const f of fixes) t.out(`  - ${f.describe}`);
    }
    if (!dryRun && !(await t.confirm(`Apply ${String(fixes.length)} fix(es)?`, input.flags))) {
      if (!json) t.out(t.dim("Not applied. Pass --yes to apply without asking."));
      return fixes.map((f) => ({ fix: f.describe, applied: false, changed: [], backups: [] }));
    }
    const reporter = new SyncReporter(t, ctx.tools);
    return fixes.map((f) => {
      const outcome = f.apply({ dryRun });
      if (!json) reporter.print(outcome, { dryRun });
      const done = outcome.results.filter((r) => r.applied);
      return {
        fix: f.describe,
        applied: !dryRun,
        changed: done.map((r) => r.plan.target.file),
        backups: done.flatMap((r) => (r.commit?.backup ? [r.commit.backup] : [])),
      };
    });
  }
}

/** What one `--fix` did (for `--json`). */
interface FixReport {
  fix: string;
  applied: boolean;
  changed: string[];
  backups: string[];
}
