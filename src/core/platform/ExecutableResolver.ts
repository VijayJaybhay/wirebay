/**
 * Finds executables such as `npx`, `uvx` and `docker`.
 *
 * GUI apps (Claude Desktop, Cursor…) often start servers without the user's shell `PATH`,
 * so this also checks paths remembered by `wirebay init` and well-known install folders.
 * @module
 */

import { statSync } from "node:fs";
import path from "node:path";
import type { WirebayPaths } from "./WirebayPaths.ts";

/** Looks up executables in remembered paths, `PATH`, and well-known install folders. */
export class ExecutableResolver {
  private readonly paths: WirebayPaths;
  private readonly remembered: Record<string, string>;
  private readonly env: NodeJS.ProcessEnv;

  /**
   * @param paths - Path helper (for the OS and user home).
   * @param remembered - Absolute paths captured at `wirebay init` (`config.json → paths`).
   * @param env - Environment providing `PATH` and `PATHEXT`.
   */
  constructor(paths: WirebayPaths, remembered: Record<string, string> = {}, env: NodeJS.ProcessEnv = process.env) {
    this.paths = paths;
    this.remembered = remembered;
    this.env = env;
  }

  /**
   * Find an executable.
   * @param command - A bare name (`npx`) or an absolute path.
   * @returns The absolute path, or `undefined` when it can't be found.
   */
  resolve(command: string): string | undefined {
    if (path.isAbsolute(command)) return ExecutableResolver.isFile(command) ? command : undefined;
    const remembered = this.remembered[command];
    if (remembered && ExecutableResolver.isFile(remembered)) return remembered;

    const windows = this.paths.os === "win32";
    const extensions = windows && !path.extname(command) ? (this.env.PATHEXT || ".EXE;.CMD;.BAT;.COM").split(";").map((e) => e.toLowerCase()) : [""];
    const pathVar = this.env.PATH || this.env.Path || "";
    const dirs = [...pathVar.split(path.delimiter).filter(Boolean), ...this.wellKnownDirs()];
    for (const dir of dirs) {
      for (const ext of extensions) {
        const candidate = path.join(dir, command + ext);
        if (ExecutableResolver.isFile(candidate)) return candidate;
      }
    }
    return undefined;
  }

  /** Install folders checked when an executable is not on `PATH`. */
  private wellKnownDirs(): string[] {
    const home = this.paths.userHome;
    if (this.paths.os === "win32") {
      const programFiles = this.env.ProgramFiles || "C:\\Program Files";
      return [
        path.join(programFiles, "nodejs"),
        path.join(this.env.APPDATA || path.join(home, "AppData", "Roaming"), "npm"),
        path.join(home, ".local", "bin"),
        path.join(home, ".cargo", "bin"),
        path.join(programFiles, "Docker", "Docker", "resources", "bin"),
      ];
    }
    return ["/opt/homebrew/bin", "/usr/local/bin", "/usr/bin", "/bin", path.join(home, ".local", "bin"), path.join(home, ".cargo", "bin")];
  }

  private static isFile(p: string): boolean {
    try {
      return statSync(p).isFile();
    } catch {
      return false;
    }
  }
}
