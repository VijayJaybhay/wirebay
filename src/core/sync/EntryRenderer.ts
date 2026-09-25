/**
 * Turns "server X for tool Y" into the entry written into that tool's config.
 * The entry always calls the wirebay launcher, so it never contains secrets.
 * @module
 */

import type { OsName, WirebayPaths } from "../platform/WirebayPaths.ts";
import type { Tool } from "../tools/Tool.ts";
import type { Entry, RenderMode, ScopeName } from "../types.ts";

/** How entries call the launcher. */
export type ResolvedMode = "absolute" | "portable" | "npx";

/** Everything the renderer needs to know about the machine. */
export interface RenderContext {
  mode: ResolvedMode;
  /** Absolute path of the Node binary. */
  nodePath: string;
  /** Absolute path of wirebay's CLI script. */
  cliPath: string;
  os: OsName;
  /** Set when `WIREBAY_HOME` isn't the default, so the launcher finds the same folder. */
  wirebayHome?: string;
}

/** Values available to a tool's entry template. */
export interface TemplateValues {
  name: string;
  command: string;
  args: string[];
  env: Record<string, string>;
}

/**
 * Renders tool entries.
 *
 * Template placeholders (as whole string values in `tool.json → entry.stdio`):
 * `{command}`, `{args}`, `{commandLine}` (`[command, ...args]`), `{env}` (omitted when empty)
 * and `{name}` (the server name).
 */
export class EntryRenderer {
  readonly context: RenderContext;

  constructor(context: RenderContext) {
    this.context = context;
  }

  /**
   * The context for this machine.
   * @param paths - For the CLI path, OS and `WIREBAY_HOME`.
   * @param configured - The configured render mode.
   * @param scope - Project files are portable (no machine paths); user files use absolute paths.
   */
  static forMachine(paths: WirebayPaths, configured: RenderMode, scope: ScopeName): EntryRenderer {
    let mode: ResolvedMode;
    if (configured === "absolute" || configured === "portable") mode = configured;
    else if (scope === "project") mode = "portable";
    else mode = paths.runningFromNpx() ? "npx" : "absolute";
    return new EntryRenderer({
      mode,
      nodePath: process.execPath,
      cliPath: paths.cliEntry(),
      os: paths.os,
      wirebayHome: paths.homeOverridden ? paths.home : undefined,
    });
  }

  /** The command line a tool should run to start a server through wirebay. */
  launcherCommand(server: string, tool: Tool): Omit<TemplateValues, "name"> {
    const ctx = this.context;
    const env: Record<string, string> = ctx.wirebayHome ? { WIREBAY_HOME: ctx.wirebayHome } : {};
    if (ctx.mode === "absolute") return { command: ctx.nodePath, args: [ctx.cliPath, "run", server], env };
    const [command, ...args] = ctx.mode === "portable" ? ["wirebay", "run", server] : ["npx", "-y", "wirebay@latest", "run", server];
    // Most tools cannot start Windows .cmd shims (wirebay.cmd, npx.cmd) directly.
    if (ctx.os === "win32" && !tool.supportsCmdShims) return { command: "cmd", args: ["/c", command, ...args], env };
    return { command, args, env };
  }

  /** The full entry for a server in a tool's config. */
  render(server: string, tool: Tool): Entry {
    const values: TemplateValues = { name: server, ...this.launcherCommand(server, tool) };
    return { ...EntryRenderer.fill(tool.manifest.entry.stdio, values), ...(tool.manifest.entry.extra ?? {}) };
  }

  /** Fill an entry template with values (recursing into nested objects). */
  static fill(template: Record<string, unknown>, values: TemplateValues): Entry {
    const out: Entry = {};
    for (const [key, raw] of Object.entries(template)) {
      if (raw === "{command}") out[key] = values.command;
      else if (raw === "{args}") out[key] = values.args;
      else if (raw === "{commandLine}") out[key] = [values.command, ...values.args];
      else if (raw === "{name}") out[key] = values.name;
      else if (raw === "{env}") {
        if (Object.keys(values.env).length) out[key] = values.env;
      } else if (raw && typeof raw === "object" && !Array.isArray(raw))
        out[key] = EntryRenderer.fill(raw as Record<string, unknown>, values);
      else out[key] = raw;
    }
    return out;
  }
}
