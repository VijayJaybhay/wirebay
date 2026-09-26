/**
 * Turns the user's selection (`all`, names, or nothing, plus `--global`/`--project`/`--dir`) into
 * concrete scopes, tools and servers.
 * @module
 */

import path from "node:path";
import type { AppContext } from "../../app/AppContext.ts";
import type { ParsedCommand, Selection } from "../../cli/CommandParser.ts";
import { UsageError } from "../../core/errors.ts";
import { StateStore } from "../../core/store/StateStore.ts";
import type { ScopeName, WirebayState } from "../../core/types.ts";

/** Resolves scopes and defaults for commands. */
export class TargetSelector {
  private readonly ctx: AppContext;
  private readonly input: ParsedCommand;

  /** Applies `--dir` immediately, so every later lookup uses that project. */
  constructor(ctx: AppContext, input: ParsedCommand) {
    this.ctx = ctx;
    this.input = input;
    const dir = input.flags.dir;
    if (typeof dir === "string") ctx.project.choose(dir);
  }

  /** The scope named on the command line, if any (`--project`, `--dir`, `--global`, `--scope`). */
  explicitScope(): ScopeName | undefined {
    const f = this.input.flags;
    const wantsProject = !!f.project || typeof f.dir === "string";
    if (wantsProject && f.global) throw new UsageError("Use either --project or --global, not both.");
    if (wantsProject) return "project";
    if (f.global) return "user";
    const s = f.scope;
    if (s === undefined) return undefined;
    if (s !== "user" && s !== "project")
      throw new UsageError(`Unknown scope "${String(s)}".`, "Use --global or --project (or --scope user|project).");
    return s;
  }

  /** The one scope a command that changes things writes to (default: the configured default, normally global). */
  scope(): ScopeName {
    const scope = this.explicitScope() ?? this.ctx.config.load().defaultScope;
    if (scope === "project") this.ctx.project.assertUsableRoot();
    return scope;
  }

  /**
   * The scopes a command that syncs or reports acts on: the explicit one, or global plus this
   * project when it has a `.wirebay.json`.
   */
  scopes(): ScopeName[] {
    const explicit = this.explicitScope();
    const scopes: ScopeName[] = explicit ? [explicit] : this.ctx.project.exists() ? ["user", "project"] : ["user"];
    if (scopes.includes("project")) this.ctx.project.assertUsableRoot();
    return scopes;
  }

  /** Human label for a scope, e.g. `global` or `project C:\code\app`. */
  label(scope: ScopeName): string {
    return scope === "user" ? "global" : `project ${this.ctx.project.root}`;
  }

  /** Every installed tool that supports the scope (every known one with `--include-missing`). */
  allTools(scope: ScopeName): string[] {
    const supports = new Set(
      this.ctx.tools
        .all()
        .filter((t) => t.scopes.includes(scope))
        .map((t) => t.id),
    );
    const candidates = this.input.flags["include-missing"] ? [...supports] : this.ctx.tools.detectInstalled(this.ctx.resolver);
    return candidates.filter((id) => supports.has(id));
  }

  /**
   * Tools to enable a newly added server for: named, `all`, the configured defaults, or detected.
   * `all` and the defaults leave out opt-in locations (see {@link TargetSelector.addableTools});
   * tools named explicitly are always used.
   */
  toolsForAdd(scope: ScopeName): string[] {
    const sel = this.input.tools;
    if (sel === "all") return this.addableTools(scope);
    if (sel?.length) return sel;
    const defaults = this.ctx.config.load().defaultTools;
    if (!defaults.length) return this.addableTools(scope);
    return this.withoutOptIn(
      defaults.filter((id) => this.ctx.tools.get(id).scopes.includes(scope)),
      scope,
    );
  }

  /**
   * Like {@link TargetSelector.allTools}, minus locations that are opt-in because another tool
   * reads that file and can't parse it (e.g. Visual Studio's global `~/.mcp.json`). Used when
   * *adding* servers; removing still reaches every tool.
   */
  addableTools(scope: ScopeName): string[] {
    return this.withoutOptIn(this.allTools(scope), scope);
  }

  /**
   * Print why opt-in tools were left out, and warn about opt-in tools that were named explicitly.
   * @param chosen - The tools the command is about to write to.
   */
  reportOptIn(scope: ScopeName, chosen: string[]): void {
    const t = this.ctx.terminal;
    for (const id of this.skippedOptIn) {
      t.note(t.dim(`- skipped ${id} (${this.label(scope)}): opt-in — ${this.optInReason(id, scope)}. Name it to use it anyway.`));
    }
    for (const id of chosen.filter((c) => this.ctx.readGraph.isOptIn(this.ctx.tools.get(c).id, scope))) {
      t.note(t.warn(`! ${id} (${this.label(scope)}): ${this.optInReason(id, scope)}.`));
    }
  }

  /** Opt-in tools left out by the last `toolsForAdd`/`addableTools` call. */
  private skippedOptIn: string[] = [];

  private withoutOptIn(ids: string[], scope: ScopeName): string[] {
    const optIn = ids.filter((id) => this.ctx.readGraph.isOptIn(this.ctx.tools.get(id).id, scope));
    this.skippedOptIn = optIn;
    return ids.filter((id) => !optIn.includes(id));
  }

  private optInReason(id: string, scope: ScopeName): string {
    const [conflict] = this.ctx.readGraph.conflictsFor(this.ctx.tools.get(id).id, scope);
    return conflict ? `${conflict.reader.name} also reads this file and can't parse it` : "another tool can't parse this file";
  }

  /** Tools a sync-like command should touch when none are named: tools in use in the scope, plus tools wirebay wrote to there. */
  toolsForSync(scope: ScopeName, state: WirebayState): string[] {
    const sel = this.input.tools;
    if (sel === "all") return this.allTools(scope);
    if (sel?.length) return sel;
    const inUse = this.ctx.desired.servers(scope).toolsInUse();
    return [...new Set([...inUse, ...this.toolsWrittenTo(scope, state)])].sort();
  }

  /** Tools wirebay has entries in for this scope (for project scope: files inside this project). */
  toolsWrittenTo(scope: ScopeName, state: WirebayState, server?: string): string[] {
    const root = path.resolve(this.ctx.project.root) + path.sep;
    return StateStore.toolsWithEntries(
      state,
      server,
      (f) => f.scope === scope && (scope === "user" || path.resolve(f.path).startsWith(root)),
    );
  }

  /** Named servers, or `undefined` for "every server". */
  servers(): string[] | undefined {
    const sel: Selection = this.input.servers;
    return sel === "all" || sel === undefined ? undefined : sel;
  }
}
