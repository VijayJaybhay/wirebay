// `wirebay tools [--stale] | tools verify <id> | tools index` and `wirebay presets [--stale]`.
// The tools directory and presets carry lastVerified dates so stale entries are easy to find.

import { existsSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { ParsedCommand } from "../cli/parse.ts";
import { c, out, printJson, table } from "../cli/ui.ts";
import { UsageError } from "../core/errors.ts";
import { verifyTool, toolsIndexMarkdown } from "../core/directory.ts";
import { packageRoot } from "../core/paths.ts";
import { loadPresets } from "../core/servers.ts";
import { loadConfig } from "../core/store.ts";
import { getTool, isInstalled, loadTools, toolConfigPath } from "../core/tools.ts";

export function daysSince(date: string | undefined, now = new Date()): number {
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return Infinity;
  return Math.floor((now.getTime() - new Date(date + "T00:00:00Z").getTime()) / 86_400_000);
}

function staleDays(cmd: ParsedCommand): number | undefined {
  if (!cmd.flags.stale) return undefined;
  const d = Number(cmd.flags.days ?? 90);
  if (!Number.isFinite(d) || d < 0) throw new UsageError("--days must be a number.");
  return d;
}

export async function toolsCommand(cmd: ParsedCommand): Promise<number> {
  const [sub, id] = cmd.rest;
  if (sub === "verify") return verify(id, cmd);
  if (sub === "index") return writeIndex();
  if (sub) throw new UsageError(`Unknown tools command "${sub}".`, "Use: wirebay tools [--stale] | tools verify <id> | tools index");

  const config = loadConfig();
  const stale = staleDays(cmd);
  const rows = loadTools()
    .map((t) => ({
      id: t.id,
      name: t.name,
      aliases: t.aliases ?? [],
      installed: isInstalled(t, config.paths),
      userConfig: toolConfigPath(t, "user") ?? null,
      projectConfig: t.configs.project ? "yes" : "no",
      status: t.status ?? "beta",
      lastVerified: t.lastVerified ?? null,
      ageDays: daysSince(t.lastVerified),
      source: t.source,
    }))
    .filter((r) => stale === undefined || r.ageDays > stale);
  if (cmd.flags.json) {
    printJson(rows.map((r) => ({ ...r, ageDays: Number.isFinite(r.ageDays) ? r.ageDays : null })));
    return 0;
  }
  out(
    table(
      ["TOOL", "ALIASES", "INSTALLED", "STATUS", "VERIFIED", "USER CONFIG"],
      rows.map((r) => [
        r.id,
        r.aliases.join(", "),
        r.installed ? c.ok("yes") : c.dim("no"),
        r.status,
        r.ageDays > 90 ? c.warn(r.lastVerified ?? "never") : (r.lastVerified ?? ""),
        c.dim(r.userConfig ?? "-"),
      ]),
    ),
  );
  if (stale !== undefined) out(c.dim(`\n${rows.length} tool(s) not verified in the last ${stale} days.`));
  return 0;
}

function verify(id: string | undefined, cmd: ParsedCommand): number {
  const tools = loadTools();
  const targets = id ? [getTool(id, tools)] : tools;
  let failed = 0;
  const results = targets.map((t) => verifyTool(t));
  if (cmd.flags.json) {
    printJson(results);
    return results.some((r) => !r.ok) ? 1 : 0;
  }
  for (const r of results) {
    out(`${r.ok ? c.ok("✓") : c.err("✗")} ${c.bold(r.tool)}`);
    for (const check of r.checks) out(`    ${check.ok ? c.ok("✓") : c.err("✗")} ${check.name}${check.detail ? c.dim(`: ${check.detail}`) : ""}`);
    if (!r.ok) failed++;
  }
  return failed ? 1 : 0;
}

function writeIndex(): number {
  const file = path.join(packageRoot, "tools", "INDEX.md");
  if (!existsSync(path.join(packageRoot, ".git")) && !existsSync(path.join(packageRoot, "scripts"))) {
    throw new UsageError("`tools index` is for contributors working in a clone of the wirebay repo.");
  }
  writeFileSync(file, toolsIndexMarkdown(loadTools()));
  out(`${c.ok("✓")} wrote ${file}`);
  return 0;
}

export async function presetsCommand(cmd: ParsedCommand): Promise<number> {
  const config = loadConfig();
  const stale = staleDays(cmd);
  const rows = [...loadPresets().values()]
    .map((p) => ({
      name: p.name,
      description: p.description ?? "",
      added: !!config.servers[p.name],
      status: p.status ?? "beta",
      lastVerified: p.lastVerified ?? null,
      ageDays: daysSince(p.lastVerified),
      guide: p.guide ?? null,
    }))
    .filter((r) => stale === undefined || r.ageDays > stale)
    .sort((a, b) => a.name.localeCompare(b.name));
  if (cmd.flags.json) {
    printJson(rows.map((r) => ({ ...r, ageDays: Number.isFinite(r.ageDays) ? r.ageDays : null })));
    return 0;
  }
  out(table(["PRESET", "ADDED", "DESCRIPTION"], rows.map((r) => [r.name, r.added ? c.ok("yes") : c.dim("no"), r.description])));
  out(c.dim("\nAdd one with: wirebay add <preset> to all   ·   any other server: wirebay add <name> --npx <package>"));
  return 0;
}
