/**
 * Prints what a sync did (or would do) in a consistent format.
 * @module
 */

import type { Terminal } from "../../cli/Terminal.ts";
import { Reconciler } from "../../core/sync/Reconciler.ts";
import type { SyncOutcome } from "../../core/sync/SyncEngine.ts";

/** Formats {@link SyncOutcome}s for humans. */
export class SyncReporter {
  private readonly terminal: Terminal;

  constructor(terminal: Terminal) {
    this.terminal = terminal;
  }

  /**
   * Print the outcome.
   * @returns True when there were conflicts or hand-edited entries (exit code 4).
   */
  print(outcome: SyncOutcome, options: { dryRun?: boolean } = {}): boolean {
    const t = this.terminal;
    let problems = false;
    for (const r of outcome.results) {
      const { plan } = r;
      const added = Object.keys(plan.changes.set);
      const removed = plan.changes.remove;
      const label = `${t.bold(plan.target.tool.name)} ${t.dim(plan.target.file)}`;
      if (!added.length && !removed.length && !plan.issues.length) {
        t.out(`${t.dim("=")} ${label} ${t.dim(plan.unchanged.length ? `(up to date: ${plan.unchanged.join(", ")})` : "(nothing to do)")}`);
        continue;
      }
      const icon = !added.length && !removed.length ? t.warn("!") : options.dryRun ? t.cyan("~") : t.ok("✓");
      t.out(`${icon} ${label}${r.commit?.via === "cli" ? t.dim(" (via the tool's CLI)") : ""}`);
      for (const name of added) t.out(`    ${t.ok("+")} ${name}`);
      for (const name of removed) t.out(`    ${t.err("-")} ${name}`);
      for (const issue of plan.issues) {
        problems = true;
        t.out(`    ${t.warn("!")} ${issue.message}`);
      }
      if (options.dryRun && Reconciler.hasChanges(plan)) {
        t.out(
          t.dim(
            Reconciler.diff(plan)
              .split("\n")
              .slice(2)
              .map((l) => "    " + l)
              .join("\n"),
          ),
        );
      }
      if (r.commit?.backup) t.out(t.dim(`    backup: ${r.commit.backup}`));
    }
    for (const s of outcome.skipped) t.note(t.dim(`- skipped ${s.tool}: ${s.reason}`));
    if (outcome.restartNeeded.length) t.out(t.warn(`Restart to pick up the changes: ${outcome.restartNeeded.join(", ")}`));
    if (options.dryRun) t.out(t.dim("Dry run: nothing was changed."));
    return problems;
  }
}
