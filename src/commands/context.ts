// Shared helpers for commands: vocabulary for the parser, resolving "all"/defaults
// into concrete tool lists, and printing sync results.

import type { ParsedCommand, Selection, Vocabulary } from "../cli/parse.ts";
import { c, note, out } from "../cli/ui.ts";
import { UsageError } from "../core/errors.ts";
import { diffPlan, hasChanges } from "../core/reconcile.ts";
import { loadServers } from "../core/servers.ts";
import type { SyncOutcome } from "../core/sync.ts";
import { toolsInConfig } from "../core/sync.ts";
import { detectInstalled, loadTools, toolAliasMap } from "../core/tools.ts";
import type { ScopeName, WirebayConfig, WirebayState } from "../core/types.ts";

export function vocabulary(): Vocabulary {
  const servers = loadServers();
  const aliases = toolAliasMap(loadTools());
  return {
    isServer: (name) => servers.has(name),
    toolId: (name) => aliases.get(name),
    words: () => [...servers.keys(), ...aliases.keys()],
  };
}

export function scopeOf(cmd: ParsedCommand, config: WirebayConfig): ScopeName {
  const s = (cmd.flags.scope as string | undefined) ?? config.defaultScope;
  if (s !== "user" && s !== "project") throw new UsageError(`Unknown scope "${s}".`, "Use --scope user or --scope project.");
  return s;
}

/** Tools that have wirebay-managed entries recorded in state. */
export function toolsInState(state: WirebayState, server?: string): string[] {
  return [
    ...new Set(
      Object.values(state.files)
        .filter((f) => !server || server in f.entries)
        .map((f) => f.tool),
    ),
  ].sort();
}

/** Every installed tool (plus every tool with --include-missing). */
export function allTools(cmd: ParsedCommand, config: WirebayConfig): string[] {
  const tools = loadTools();
  return cmd.flags["include-missing"] ? tools.map((t) => t.id) : detectInstalled(tools, config.paths);
}

/** Tools to enable a newly added server for. */
export function toolsForAdd(sel: Selection, cmd: ParsedCommand, config: WirebayConfig): string[] {
  if (sel === "all") return allTools(cmd, config);
  if (sel?.length) return sel;
  if (config.defaultTools.length) return config.defaultTools;
  return allTools(cmd, config);
}

/** Tools a sync-like command should touch when the user did not name any. */
export function toolsForSync(sel: Selection, config: WirebayConfig, state: WirebayState): string[] {
  if (Array.isArray(sel) && sel.length) return sel;
  return [...new Set([...toolsInConfig(config), ...toolsInState(state)])].sort();
}

export function serverList(sel: Selection, config: WirebayConfig): string[] | undefined {
  if (sel === "all" || sel === undefined) return undefined;
  return sel;
}

/** Print what a sync did (or would do). Returns true when there were conflicts or drift. */
export function printOutcome(outcome: SyncOutcome, opts: { dryRun?: boolean; quiet?: boolean } = {}): boolean {
  let problems = false;
  for (const r of outcome.results) {
    const { plan } = r;
    const added = Object.keys(plan.changes.set);
    const removed = plan.changes.remove;
    const label = `${c.bold(plan.target.tool.name)} ${c.dim(plan.target.file)}`;
    if (!added.length && !removed.length && !plan.issues.length) {
      if (!opts.quiet) out(`${c.dim("=")} ${label} ${c.dim(plan.unchanged.length ? `(up to date: ${plan.unchanged.join(", ")})` : "(nothing to do)")}`);
      continue;
    }
    const icon = !added.length && !removed.length ? c.warn("!") : opts.dryRun ? c.cyan("~") : c.ok("✓");
    out(`${icon} ${label}${r.via === "cli" ? c.dim(" (via the tool's CLI)") : ""}`);
    for (const name of added) out(`    ${c.ok("+")} ${name}`);
    for (const name of removed) out(`    ${c.err("-")} ${name}`);
    for (const i of plan.issues) {
      problems = true;
      out(`    ${c.warn("!")} ${i.message}`);
    }
    if (opts.dryRun && hasChanges(plan)) out(c.dim(diffPlan(plan).split("\n").slice(2).map((l) => "    " + l).join("\n")));
    if (r.backup) out(c.dim(`    backup: ${r.backup}`));
  }
  for (const s of outcome.skipped) note(c.dim(`- skipped ${s.tool}: ${s.reason}`));
  if (outcome.restartNeeded.length) out(c.warn(`Restart to pick up the changes: ${outcome.restartNeeded.join(", ")}`));
  if (opts.dryRun) out(c.dim("Dry run: nothing was changed."));
  return problems;
}
