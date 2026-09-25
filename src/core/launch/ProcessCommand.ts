/**
 * Turning "run this executable with these args" into something `child_process.spawn` can start,
 * including Windows `.cmd`/`.bat` shims (which can't be spawned without a shell).
 * @module
 */

import { existsSync } from "node:fs";
import path from "node:path";
import { WirebayPaths } from "../platform/WirebayPaths.ts";

/** A ready-to-spawn command. */
export interface SpawnSpec {
  command: string;
  args: string[];
  /** Windows only: pass args to cmd.exe without Node re-quoting them. */
  verbatim: boolean;
}

/** Builds spawnable commands, working around Windows `.cmd` shims safely (no `shell: true`). */
export class ProcessCommand {
  private static readonly cmdMeta = /([()\][%!^"`<>&|;, *?])/g;

  /**
   * @param resolved - Absolute path of the executable.
   * @param args - Arguments to pass.
   * @param os - Target OS (defaults to the current one).
   */
  static forExecutable(resolved: string, args: string[], os = WirebayPaths.detectOs()): SpawnSpec {
    if (os !== "win32" || !/\.(cmd|bat)$/i.test(resolved)) return { command: resolved, args, verbatim: false };

    // npx/npm: run their JavaScript entry with Node directly. No shell, no quoting problems.
    const dir = path.dirname(resolved);
    const base = path.basename(resolved).toLowerCase();
    if (base === "npx.cmd" || base === "npm.cmd") {
      const script = path.join(dir, "node_modules", "npm", "bin", base === "npx.cmd" ? "npx-cli.js" : "npm-cli.js");
      const node = existsSync(path.join(dir, "node.exe")) ? path.join(dir, "node.exe") : process.execPath;
      if (existsSync(script)) return { command: node, args: [script, ...args], verbatim: false };
    }
    // Other shims: go through cmd.exe with careful escaping.
    const line = [ProcessCommand.escapeCommand(resolved), ...args.map((a) => ProcessCommand.escapeArg(a))].join(" ");
    return { command: process.env.ComSpec || "cmd.exe", args: ["/d", "/s", "/c", `"${line}"`], verbatim: true };
  }

  private static escapeCommand(cmd: string): string {
    return cmd.replace(ProcessCommand.cmdMeta, "^$1");
  }

  /** Quote for CommandLineToArgvW, then escape cmd.exe metacharacters (twice: `.cmd` shims re-parse). */
  private static escapeArg(arg: string): string {
    let quoted = `"${arg.replace(/(\\*)"/g, '$1$1\\"').replace(/(\\*)$/, "$1$1")}"`;
    quoted = quoted.replace(ProcessCommand.cmdMeta, "^$1");
    return quoted.replace(ProcessCommand.cmdMeta, "^$1");
  }
}
