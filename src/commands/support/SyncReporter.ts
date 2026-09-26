/**
 * Prints what a sync did (or would do) in a consistent format.
 * @module
 */

import type { Terminal } from "../../cli/Terminal.ts";
import type { ToolRegistry } from "../../core/tools/ToolRegistry.ts";
import { ReadNotes } from "./ReadNotes.ts";
import { Reconciler } from "../../core/sync/Reconciler.ts";
import type { SyncEngine, SyncOutcome, SyncRequest } from "../../core/sync/SyncEngine.ts";

/** Formats {@link SyncOutcome}s for humans. */
export class SyncReporter {
  private readonly terminal: Terminal;
  private readonly notes: ReadNotes;

  /**
   * @param terminal - Where to print.
   * @param tools - Used to name tools in "may also load … via …" notes.
   */
  constructor(terminal: Terminal, tools: ToolRegistry) {
    this.terminal = terminal;
    this.notes = new ReadNotes(tools, terminal);
  }

  /**
   * Run a sync with a progress line (`Updating Cursor…`), then print the outcome.
   * @returns True when there were conflicts or hand-edited entries (exit code 4).
   */
  run(engine: SyncEngine, request: SyncRequest): boolean {
    const verb = request.dryRun ? "Checking" : request.removeOnly ? "Removing from" : "Updating";
    const progress = this.terminal.progress(`${verb} tool configs…`);
    let outcome: SyncOutcome;
    try {
      outcome = engine.run({
        ...request,
        onTool: (tool) => {
          progress.update(`${verb} ${tool.name}…`);
        },
      });
    } finally {
      progress.stop();
    }
    return this.print(outcome, { dryRun: request.dryRun });
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
      if (plan.deleteFile) {
        const verb = options.dryRun ? "would delete" : "deleted";
        t.out(
          `    ${t.err("-")} ${verb} the file: nothing is left in it and ${plan.created ? "wirebay created it" : "another tool can't parse it"}`,
        );
      }
      if (r.commit?.backup)
        t.out(
          t.dim(
            `    backup: ${r.commit.backup}${r.commit.deleted ? " (restore it with: wirebay restore " + plan.target.tool.id + ")" : ""}`,
          ),
        );
    }
    for (const s of outcome.skipped) t.note(t.dim(`- skipped ${s.tool}: ${s.reason}`));
    for (const line of this.notes.overlapLines(outcome.overlaps)) t.out(line);
    if (outcome.restartNeeded.length) t.out(t.warn(`Restart to pick up the changes: ${outcome.restartNeeded.join(", ")}`));
    if (options.dryRun) t.out(t.dim("Dry run: nothing was changed."));
    return problems;
  }
}
