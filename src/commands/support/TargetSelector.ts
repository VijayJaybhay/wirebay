/**
 * Turns the user's selection (`all`, names, or nothing) into concrete tool and server lists.
 * @module
 */

import type { AppContext } from "../../app/AppContext.ts";
import type { ParsedCommand, Selection } from "../../cli/CommandParser.ts";
import { UsageError } from "../../core/errors.ts";
import { ConfigStore } from "../../core/store/ConfigStore.ts";
import { StateStore } from "../../core/store/StateStore.ts";
import type { ScopeName, WirebayConfig, WirebayState } from "../../core/types.ts";

/** Resolves defaults and `all` for commands. */
export class TargetSelector {
  private readonly ctx: AppContext;
  private readonly input: ParsedCommand;

  constructor(ctx: AppContext, input: ParsedCommand) {
    this.ctx = ctx;
    this.input = input;
  }

  /** The scope to use (`--scope`, else the configured default). */
  scope(config: WirebayConfig): ScopeName {
    const s = (this.input.flags.scope as string | undefined) ?? config.defaultScope;
    if (s !== "user" && s !== "project") throw new UsageError(`Unknown scope "${s}".`, "Use --scope user or --scope project.");
    return s;
  }

  /** Every installed tool (every known tool with `--include-missing`). */
  allTools(): string[] {
    if (this.input.flags["include-missing"]) return this.ctx.tools.all().map((t) => t.id);
    return this.ctx.tools.detectInstalled(this.ctx.resolver);
  }

  /** Tools to enable a newly added server for: named, `all`, the configured defaults, or detected. */
  toolsForAdd(config: WirebayConfig): string[] {
    const sel = this.input.tools;
    if (sel === "all") return this.allTools();
    if (sel?.length) return sel;
    return config.defaultTools.length ? config.defaultTools : this.allTools();
  }

  /** Tools a sync-like command should touch when none are named: tools in use plus tools wirebay wrote to. */
  toolsForSync(config: WirebayConfig, state: WirebayState): string[] {
    const sel = this.input.tools;
    if (sel === "all") return this.allTools();
    if (sel?.length) return sel;
    return [...new Set([...ConfigStore.toolsInUse(config), ...StateStore.toolsWithEntries(state)])].sort();
  }

  /** Named servers, or `undefined` for "every server". */
  servers(): string[] | undefined {
    const sel: Selection = this.input.servers;
    return sel === "all" || sel === undefined ? undefined : sel;
  }
}
