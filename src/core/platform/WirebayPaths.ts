/**
 * Where things live: the user's home, the wirebay home (`~/.wirebay`), the installed package,
 * and per-OS path expansion for tool manifests.
 * @module
 */

import { existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { PerOs } from "../types.ts";
import { nonEmpty } from "../util/values.ts";

/** Operating systems wirebay distinguishes between. */
export type OsName = "win32" | "darwin" | "linux";

/**
 * Resolves every filesystem location wirebay uses.
 *
 * Construct it with an environment so tests (and `WIREBAY_HOME` / `WIREBAY_USER_HOME`
 * overrides) never touch the real home folder.
 *
 * @example
 * const paths = new WirebayPaths({ ...process.env, WIREBAY_HOME: "/tmp/wb" });
 * paths.secretsFile; // "/tmp/wb/secrets.env"
 */
export class WirebayPaths {
  /** Root of the installed package; the same from `src/` (dev) and `dist/` (published). */
  static readonly packageRoot: string = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

  /** The current operating system. */
  readonly os: OsName;
  /** The user's home folder (`WIREBAY_USER_HOME` overrides it for sandboxes and tests). */
  readonly userHome: string;
  /** The wirebay home folder, `~/.wirebay` unless `WIREBAY_HOME` is set. */
  readonly home: string;
  /** True when `WIREBAY_HOME` points somewhere other than the default. */
  readonly homeOverridden: boolean;
  /** True when `WIREBAY_USER_HOME` is set, i.e. we are running in a sandbox. */
  readonly sandboxed: boolean;

  private readonly env: NodeJS.ProcessEnv;

  /**
   * @param env - Environment to read overrides from (defaults to `process.env`).
   */
  constructor(env: NodeJS.ProcessEnv = process.env) {
    this.env = env;
    this.os = WirebayPaths.detectOs();
    const userHome = nonEmpty(env.WIREBAY_USER_HOME);
    const home = nonEmpty(env.WIREBAY_HOME);
    this.sandboxed = userHome !== undefined;
    this.userHome = userHome ?? os.homedir();
    this.homeOverridden = home !== undefined;
    this.home = home ?? path.join(this.userHome, ".wirebay");
  }

  /** `~/.wirebay/config.json`: the desired state. */
  get configFile(): string {
    return path.join(this.home, "config.json");
  }

  /** `~/.wirebay/state.json`: what wirebay wrote. */
  get stateFile(): string {
    return path.join(this.home, "state.json");
  }

  /** `~/.wirebay/secrets.env`: all secrets. */
  get secretsFile(): string {
    return path.join(this.home, "secrets.env");
  }

  /** `~/.wirebay/servers/`: custom servers and preset overrides. */
  get serversDir(): string {
    return path.join(this.home, "servers");
  }

  /** `~/.wirebay/tools/`: user tool manifests and overrides. */
  get toolsDir(): string {
    return path.join(this.home, "tools");
  }

  /** `~/.wirebay/credentials/`: secret files such as service-account keys. */
  get credentialsDir(): string {
    return path.join(this.home, "credentials");
  }

  /** `~/.wirebay/backups/`: backups of tool config files. */
  get backupsDir(): string {
    return path.join(this.home, "backups");
  }

  /** `~/.wirebay/logs/`: launcher logs. */
  get logsDir(): string {
    return path.join(this.home, "logs");
  }

  /**
   * A path inside the installed package.
   * @param parts - Path segments below the package root, e.g. `("presets")`.
   */
  static packagePath(...parts: string[]): string {
    return path.join(WirebayPaths.packageRoot, ...parts);
  }

  /** The CLI script tool configs should call: `dist/cli.js` when published, `src/cli.ts` in development. */
  cliEntry(): string {
    const source = WirebayPaths.packagePath("src", "cli.ts");
    const built = WirebayPaths.packagePath("dist", "cli.js");
    const runningFromSource = fileURLToPath(import.meta.url).endsWith(".ts");
    if (runningFromSource && existsSync(source)) return source;
    return existsSync(built) ? built : source;
  }

  /** True when wirebay itself was started from the npx cache (whose path is not stable). */
  runningFromNpx(): boolean {
    return /[\\/]_npx[\\/]/.test(WirebayPaths.packageRoot);
  }

  /**
   * Pick the value for the current OS from a per-OS object (or return a plain value unchanged).
   * @param value - A value or `{ win32, darwin, linux }`.
   */
  pick<T>(value: PerOs<T> | undefined): T | undefined {
    if (value === undefined || value === null) return undefined;
    if (typeof value === "object" && !Array.isArray(value) && ("win32" in value || "darwin" in value || "linux" in value)) {
      return (value as Partial<Record<OsName, T>>)[this.os];
    }
    return value as T;
  }

  /**
   * Expand the placeholders used in tool manifests:
   * - `~` / `{home}`: the user's home
   * - `{appdata}`: `%APPDATA%`, `~/Library/Application Support` or `~/.config`
   * - `{config}`: `%APPDATA%` on Windows, `~/.config` elsewhere
   * - `{cwd}`: the project folder
   * - `${VAR}` / `${VAR:-fallback}`: environment variables
   *
   * @param p - The path template.
   * @param cwd - Project folder for `{cwd}`.
   */
  expand(p: string, cwd: string = process.cwd()): string {
    const appdata = this.appdata();
    let out = p.replace(/\$\{([A-Z0-9_]+)(?::-([^}]*))?\}/gi, (_m, name: string, fallback?: string) => {
      const v = this.env[name];
      return v && v.length > 0 ? v : (fallback ?? "");
    });
    out = out
      .replace(/\{home\}/g, this.userHome)
      .replace(/\{appdata\}/g, appdata)
      .replace(/\{config\}/g, this.os === "win32" ? appdata : path.join(this.userHome, ".config"))
      .replace(/\{cwd\}/g, cwd);
    if (out === "~" || out.startsWith("~/") || out.startsWith("~\\")) out = path.join(this.userHome, out.slice(1));
    return path.normalize(out);
  }

  /** The per-user application data folder for the current OS. */
  appdata(): string {
    if (!this.sandboxed && this.os === "win32" && this.env.APPDATA) return this.env.APPDATA;
    switch (this.os) {
      case "win32":
        return path.join(this.userHome, "AppData", "Roaming");
      case "darwin":
        return path.join(this.userHome, "Library", "Application Support");
      default:
        return path.join(this.userHome, ".config");
    }
  }

  /** Detect the current OS (anything that isn't Windows or macOS is treated as Linux). */
  static detectOs(): OsName {
    const p = process.platform;
    return p === "win32" || p === "darwin" ? p : "linux";
  }
}
