/**
 * Orchestrates a sync across tools: desired state → rendered entries → per-file plans → apply.
 * @module
 */

import { existsSync } from "node:fs";
import type { AppContext } from "../../app/AppContext.ts";
import type { CommitResult, Target } from "../adapters/ToolAdapter.ts";
import type { Tool } from "../tools/Tool.ts";
import type { Entry, RenderMode, ScopeName } from "../types.ts";
import { EntryRenderer } from "./EntryRenderer.ts";
import type { TargetPlan } from "./Reconciler.ts";

/** What to sync. */
export interface SyncRequest {
  /** Tool ids to touch. */
  tools: string[];
  /** `user` (global tool configs) or `project` (the current project's tool configs). */
  scope: ScopeName;
  /** Limit to these servers (undefined = every server). */
  servers?: string[];
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
  scope: ScopeName;
  results: TargetResult[];
  skipped: { tool: string; reason: string }[];
  /** Names of tools that need a restart to pick up the changes. */
  restartNeeded: string[];
}

/** Runs syncs for one scope. Uses the context's stores, registries and reconciler. */
export class SyncEngine {
  private readonly ctx: AppContext;

  constructor(ctx: AppContext) {
    this.ctx = ctx;
  }

  /** Folder that project-scope paths (`{cwd}`) resolve against: the project root. */
  baseDir(scope: ScopeName): string {
    return scope === "project" ? this.ctx.project.root : this.ctx.cwd;
  }

  /** The config file target for a tool and scope, or `undefined` when the tool has no such scope. */
  targetFor(tool: Tool, scope: ScopeName): Target | undefined {
    const file = tool.configPath(scope, this.ctx.paths, this.baseDir(scope));
    return file ? { tool, scope, file } : undefined;
  }

  /** Rendered entries for the given servers, as they should appear in a tool. */
  desiredEntries(renderMode: RenderMode, tool: Tool, scope: ScopeName, names: string[]): Record<string, Entry> {
    const renderer = EntryRenderer.forMachine(this.ctx.paths, renderMode, scope);
    const out: Record<string, Entry> = {};
    for (const name of names) if (this.ctx.servers.has(name)) out[name] = renderer.render(name, tool);
    return out;
  }

  /** Plan (and unless `dryRun`, apply) a sync for one scope. */
  run(request: SyncRequest): SyncOutcome {
    const { scope } = request;
    const config = this.ctx.config.load();
    const desired = this.ctx.desired.servers(scope);
    const state = this.ctx.state.load();
    const outcome: SyncOutcome = { scope, results: [], skipped: [], restartNeeded: [] };

    for (const toolId of request.tools) {
      const tool = this.ctx.tools.get(toolId);
      const target = this.targetFor(tool, scope);
      if (!target) {
        outcome.skipped.push({ tool: tool.id, reason: SyncEngine.noScopeReason(tool, scope) });
        continue;
      }
      const exists = existsSync(target.file);
      if (!exists && request.removeOnly) continue;
      if (!exists && !request.includeMissing && !tool.isInstalled(this.ctx.resolver, this.ctx.paths)) {
        outcome.skipped.push({
          tool: tool.id,
          reason: `${tool.name} does not look installed (use --include-missing to write its config anyway)`,
        });
        continue;
      }

      const enabled = desired.serversForTool(tool.id);
      const only = request.servers;
      const wanted = request.removeOnly ? [] : only ? enabled.filter((s) => only.includes(s)) : enabled;
      const plan = this.ctx.reconciler.plan(target, state, {
        desired: this.desiredEntries(config.renderMode, tool, scope, wanted),
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

  /** Why a tool was skipped for a scope it doesn't support. */
  static noScopeReason(tool: Tool, scope: ScopeName): string {
    if (scope === "project") return `${tool.name} has no project-level MCP config; use --global for it`;
    return `${tool.name} only supports project-level MCP config; use --project for it`;
  }
}
