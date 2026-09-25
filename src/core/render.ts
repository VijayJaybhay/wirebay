// Turns "server X for tool Y" into the entry written into that tool's config.
// The entry always calls the wirebay launcher, so it never contains secrets.

import { cliEntryPath, currentOs, runningFromNpx } from "./paths.ts";
import type { Entry, RenderMode, ScopeName, ToolManifest } from "./types.ts";

export type ResolvedMode = "absolute" | "portable" | "npx";

export interface RenderContext {
  mode: ResolvedMode;
  nodePath: string;
  cliPath: string;
  os: "win32" | "darwin" | "linux";
  /** Set when WIREBAY_HOME is not the default, so the launcher finds the same home. */
  wirebayHome?: string;
}

/** Pick the render mode: project files are portable (no machine paths); user files use absolute paths. */
export function resolveMode(configured: RenderMode, scope: ScopeName): ResolvedMode {
  if (configured === "absolute" || configured === "portable") return configured;
  if (scope === "project") return "portable";
  return runningFromNpx() ? "npx" : "absolute";
}

export function defaultRenderContext(configured: RenderMode, scope: ScopeName): RenderContext {
  return {
    mode: resolveMode(configured, scope),
    nodePath: process.execPath,
    cliPath: cliEntryPath(),
    os: currentOs(),
    wirebayHome: process.env.WIREBAY_HOME || undefined,
  };
}

/** The command line a tool should run to start `server` through wirebay. */
export function launcherCommand(
  server: string,
  tool: ToolManifest,
  ctx: RenderContext,
): { command: string; args: string[]; env: Record<string, string> } {
  const env: Record<string, string> = ctx.wirebayHome ? { WIREBAY_HOME: ctx.wirebayHome } : {};
  if (ctx.mode === "absolute") {
    return { command: ctx.nodePath, args: [ctx.cliPath, "run", server], env };
  }
  const base = ctx.mode === "portable" ? ["wirebay", "run", server] : ["npx", "-y", "wirebay@latest", "run", server];
  // Most tools cannot start Windows .cmd shims (wirebay.cmd, npx.cmd) directly.
  if (ctx.os === "win32" && !tool.supports?.cmdShims) {
    return { command: "cmd", args: ["/c", ...base], env };
  }
  return { command: base[0]!, args: base.slice(1), env };
}

/** Fill a tool's entry template ({command}, {args}, {env}) and add its extra fields. */
export function fillTemplate(template: Record<string, unknown>, values: { command: string; args: string[]; env: Record<string, string> }): Entry {
  const out: Entry = {};
  for (const [key, raw] of Object.entries(template)) {
    if (raw === "{command}") out[key] = values.command;
    else if (raw === "{args}") out[key] = values.args;
    else if (raw === "{env}") {
      if (Object.keys(values.env).length) out[key] = values.env;
    } else if (raw && typeof raw === "object" && !Array.isArray(raw)) out[key] = fillTemplate(raw as Record<string, unknown>, values);
    else out[key] = raw;
  }
  return out;
}

export function renderEntry(server: string, tool: ToolManifest, ctx: RenderContext): Entry {
  return { ...fillTemplate(tool.entry.stdio, launcherCommand(server, tool, ctx)), ...(tool.entry.extra ?? {}) };
}
