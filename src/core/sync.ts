// Orchestrates a sync: config (desired) → rendered entries → per-file plans → apply.
// Commands (sync, add, enable, remove, unsync, export) all go through here.

import { existsSync } from "node:fs";
import type { Target } from "../adapters/types.ts";
import { applyPlan, planTarget, type TargetPlan } from "./reconcile.ts";
import { defaultRenderContext, renderEntry } from "./render.ts";
import { loadServers } from "./servers.ts";
import { loadConfig, loadState, saveState } from "./store.ts";
import { getTool, isInstalled, loadTools, toolConfigPath } from "./tools.ts";
import type { Entry, ScopeName, ToolManifest, WirebayConfig } from "./types.ts";

export interface SyncRequest {
  /** Tool ids to sync. */
  tools: string[];
  /** Limit the operation to these servers (undefined = every server). */
  servers?: string[];
  scope?: ScopeName;
  force?: boolean;
  dryRun?: boolean;
  /** Also create config files for tools that don't look installed. */
  includeMissing?: boolean;
  /** Remove these servers' entries instead of syncing them (unsync). */
  removeOnly?: boolean;
  cwd?: string;
}

export interface TargetResult {
  plan: TargetPlan;
  applied: boolean;
  via?: "file" | "cli";
  backup?: string;
}

export interface SyncOutcome {
  results: TargetResult[];
  skipped: { tool: string; reason: string }[];
  restartNeeded: string[];
}

/** Servers enabled for a tool in the config. */
export function serversForTool(config: WirebayConfig, toolId: string): string[] {
  return Object.entries(config.servers)
    .filter(([, s]) => s.tools.includes(toolId))
    .map(([name]) => name)
    .sort();
}

/** Tools that have at least one enabled server. */
export function toolsInConfig(config: WirebayConfig): string[] {
  return [...new Set(Object.values(config.servers).flatMap((s) => s.tools))].sort();
}

export function desiredEntries(config: WirebayConfig, tool: ToolManifest, scope: ScopeName, names: string[]): Record<string, Entry> {
  const known = loadServers();
  const ctx = defaultRenderContext(config.renderMode, scope);
  const out: Record<string, Entry> = {};
  for (const name of names) {
    if (known.has(name)) out[name] = renderEntry(name, tool, ctx);
  }
  return out;
}

export function targetFor(tool: ToolManifest, scope: ScopeName, cwd?: string): Target | undefined {
  const file = toolConfigPath(tool, scope, cwd);
  return file ? { tool, scope, file } : undefined;
}

export function runSync(req: SyncRequest): SyncOutcome {
  const config = loadConfig();
  const state = loadState();
  const tools = loadTools();
  const scope = req.scope ?? config.defaultScope;
  const outcome: SyncOutcome = { results: [], skipped: [], restartNeeded: [] };

  for (const toolId of req.tools) {
    const tool = getTool(toolId, tools);
    const target = targetFor(tool, scope, req.cwd);
    if (!target) {
      outcome.skipped.push({ tool: tool.id, reason: `${tool.name} has no ${scope}-scope config` });
      continue;
    }
    if (!existsSync(target.file) && !req.includeMissing && !isInstalled(tool, config.paths) && !req.removeOnly) {
      outcome.skipped.push({ tool: tool.id, reason: `${tool.name} does not look installed (use --include-missing to write its config anyway)` });
      continue;
    }
    if (!existsSync(target.file) && req.removeOnly) continue;

    const enabled = serversForTool(config, tool.id);
    const wanted = req.removeOnly ? [] : req.servers ? enabled.filter((s) => req.servers!.includes(s)) : enabled;
    const plan = planTarget(target, state, {
      desired: desiredEntries(config, tool, scope, wanted),
      scopeNames: req.servers ? new Set(req.servers) : undefined,
      force: req.force,
    });
    const result: TargetResult = { plan, applied: false };
    if (!req.dryRun) {
      const r = applyPlan(plan, state);
      result.applied = !!r;
      result.via = r?.via;
      result.backup = r?.backup;
      if (r && tool.restartRequired) outcome.restartNeeded.push(tool.name);
    }
    outcome.results.push(result);
  }
  if (!req.dryRun) saveState(state);
  return outcome;
}
