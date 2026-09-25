/**
 * Orchestrates a sync across tools: desired state → rendered entries → per-file plans → apply.
 * @module
 */

import { existsSync } from "node:fs";
import type { AppContext } from "../../app/AppContext.ts";
import type { CommitResult, Target } from "../adapters/ToolAdapter.ts";
import { ConfigStore } from "../store/ConfigStore.ts";
import type { Tool } from "../tools/Tool.ts";
import type { Entry, ScopeName, WirebayConfig } from "../types.ts";
import { EntryRenderer } from "./EntryRenderer.ts";
import type { TargetPlan } from "./Reconciler.ts";

/** What to sync. */
export interface SyncRequest {
  /** Tool ids to touch. */
  tools: string[];
  /** Limit to these servers (undefined = every server). */
  servers?: string[];
  scope?: ScopeName;
  /** Overwrite conflicts and drift. */
  force?: boolean;
  /** Plan only; write nothing. */
  dryRun?: boolean;
  /** Also write configs for tools that don't look installed. */
  includeMissing?: boolean;
  /** Remove the servers' entries instead of syncing them (unsync). */
  removeOnly?: boolean;
}

/** The result for one tool file. */
export interface TargetResult {
  plan: TargetPlan;
  applied: boolean;
  commit?: CommitResult;
}

/** The result of a sync. */
export interface SyncOutcome {
  results: TargetResult[];
  skipped: { tool: string; reason: string }[];
  /** Names of tools that need a restart to pick up the changes. */
  restartNeeded: string[];
}

/** Runs syncs. Uses the context's stores, registries and reconciler. */
export class SyncEngine {
  private readonly ctx: AppContext;

  constructor(ctx: AppContext) {
    this.ctx = ctx;
  }

  /** The config file target for a tool and scope, or `undefined` when the tool has no such scope. */
  targetFor(tool: Tool, scope: ScopeName): Target | undefined {
    const file = tool.configPath(scope, this.ctx.paths, this.ctx.cwd);
    return file ? { tool, scope, file } : undefined;
  }

  /** Rendered entries for the given servers, as they should appear in a tool. */
  desiredEntries(config: WirebayConfig, tool: Tool, scope: ScopeName, names: string[]): Record<string, Entry> {
    const renderer = EntryRenderer.forMachine(this.ctx.paths, config.renderMode, scope);
    const out: Record<string, Entry> = {};
    for (const name of names) if (this.ctx.servers.has(name)) out[name] = renderer.render(name, tool);
    return out;
  }

  /** Plan (and unless `dryRun`, apply) a sync. */
  run(request: SyncRequest): SyncOutcome {
    const config = this.ctx.config.load();
    const state = this.ctx.state.load();
    const scope = request.scope ?? config.defaultScope;
    const outcome: SyncOutcome = { results: [], skipped: [], restartNeeded: [] };

    for (const toolId of request.tools) {
      const tool = this.ctx.tools.get(toolId);
      const target = this.targetFor(tool, scope);
      if (!target) {
        const other = tool.scopes.filter((s) => s !== scope);
        outcome.skipped.push({ tool: tool.id, reason: `${tool.name} has no ${scope}-scope config${other.length ? ` (try --scope ${other[0]})` : ""}` });
        continue;
      }
      const exists = existsSync(target.file);
      if (!exists && request.removeOnly) continue;
      if (!exists && !request.includeMissing && !tool.isInstalled(this.ctx.resolver, this.ctx.paths)) {
        outcome.skipped.push({ tool: tool.id, reason: `${tool.name} does not look installed (use --include-missing to write its config anyway)` });
        continue;
      }

      const enabled = ConfigStore.serversForTool(config, tool.id);
      const wanted = request.removeOnly ? [] : request.servers ? enabled.filter((s) => request.servers!.includes(s)) : enabled;
      const plan = this.ctx.reconciler.plan(target, state, {
        desired: this.desiredEntries(config, tool, scope, wanted),
        scopeNames: request.servers ? new Set(request.servers) : undefined,
        force: request.force,
      });
      const result: TargetResult = { plan, applied: false };
      if (!request.dryRun) {
        result.commit = this.ctx.reconciler.apply(plan, state);
        result.applied = !!result.commit;
        if (result.commit && tool.restartRequired) outcome.restartNeeded.push(tool.name);
      }
      outcome.results.push(result);
    }
    if (!request.dryRun) this.ctx.state.save(state);
    return outcome;
  }
}
