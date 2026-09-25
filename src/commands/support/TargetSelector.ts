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
    return this.explicitScope() ?? this.ctx.config.load().defaultScope;
  }

  /**
   * The scopes a command that syncs or reports acts on: the explicit one, or global plus this
   * project when it has a `.wirebay.json`.
   */
  scopes(): ScopeName[] {
    const explicit = this.explicitScope();
    if (explicit) return [explicit];
    return this.ctx.project.exists() ? ["user", "project"] : ["user"];
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

  /** Tools to enable a newly added server for: named, `all`, the configured defaults, or detected. */
  toolsForAdd(scope: ScopeName): string[] {
    const sel = this.input.tools;
    if (sel === "all") return this.allTools(scope);
    if (sel?.length) return sel;
    const defaults = this.ctx.config.load().defaultTools;
    if (!defaults.length) return this.allTools(scope);
    return defaults.filter((id) => this.ctx.tools.get(id).scopes.includes(scope));
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
