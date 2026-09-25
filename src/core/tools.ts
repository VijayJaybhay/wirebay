// Loads the tools directory (package tools/ + user overrides in ~/.wirebay/tools/)
// and answers "which tools exist, what are they called, and are they installed?".

import { existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { WirebayError } from "./errors.ts";
import { readJsonIfExists } from "./io.ts";
import { expandPath, homePaths, packagePaths, pickOs, resolveExecutable } from "./paths.ts";
import type { ScopeName, ToolManifest } from "./types.ts";
import { validateAgainst } from "./validate.ts";

function readManifests(dir: string, source: ToolManifest["source"]): ToolManifest[] {
  if (!existsSync(dir)) return [];
  const out: ToolManifest[] = [];
  for (const name of readdirSync(dir)) {
    if (name.startsWith("_")) continue;
    const file = path.join(dir, name, "tool.json");
    const manifest = readJsonIfExists<ToolManifest>(file);
    if (!manifest) continue;
    const errors = validateAgainst("tool", manifest);
    if (errors.length) {
      throw new WirebayError(`Invalid tool manifest ${file}:\n  ${errors.join("\n  ")}`, {
        hint: "Fix the manifest (see schemas/tool.schema.json) or remove it.",
      });
    }
    out.push({ ...manifest, source });
  }
  return out;
}

/** All tool manifests. A user manifest with the same id replaces the packaged one. */
export function loadTools(): ToolManifest[] {
  const byId = new Map<string, ToolManifest>();
  for (const t of readManifests(packagePaths.tools, "package")) byId.set(t.id, t);
  for (const t of readManifests(homePaths.tools(), "user")) byId.set(t.id, t);
  return [...byId.values()].sort((a, b) => a.id.localeCompare(b.id));
}

/** Map of every id and alias → tool id. */
export function toolAliasMap(tools = loadTools()): Map<string, string> {
  const map = new Map<string, string>();
  for (const t of tools) {
    map.set(t.id, t.id);
    for (const a of t.aliases ?? []) map.set(a, t.id);
  }
  return map;
}

export function getTool(idOrAlias: string, tools = loadTools()): ToolManifest {
  const id = toolAliasMap(tools).get(idOrAlias);
  const tool = tools.find((t) => t.id === id);
  if (!tool) {
    throw new WirebayError(`Unknown tool "${idOrAlias}".`, { hint: "Run `wirebay tools` to see supported tools." });
  }
  return tool;
}

/** Resolve the config file a tool uses for a scope, or undefined when the tool has no such scope. */
export function toolConfigPath(tool: ToolManifest, scope: ScopeName, cwd = process.cwd()): string | undefined {
  const loc = tool.configs[scope];
  if (!loc) return undefined;
  const raw = pickOs(loc.path);
  return raw ? expandPath(raw, cwd) : undefined;
}

/** A tool counts as installed when one of its commands is on PATH or one of its detect paths exists. */
export function isInstalled(tool: ToolManifest, captured: Record<string, string> = {}): boolean {
  for (const cmd of tool.detect?.commands ?? []) {
    if (resolveExecutable(cmd, captured)) return true;
  }
  for (const p of tool.detect?.paths ?? []) {
    const raw = pickOs(p);
    if (raw && existsSync(expandPath(raw))) return true;
  }
  const userPath = toolConfigPath(tool, "user");
  return userPath ? existsSync(userPath) : false;
}

export function detectInstalled(tools = loadTools(), captured: Record<string, string> = {}): string[] {
  return tools.filter((t) => isInstalled(t, captured)).map((t) => t.id);
}
