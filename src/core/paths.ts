// Filesystem locations: the wirebay home, the package root, per-OS path expansion
// and executable lookup (GUI apps often start servers without a shell PATH).

import { existsSync, statSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { PerOs } from "./types.ts";

/** The user's home directory. WIREBAY_USER_HOME overrides it (used by tests). */
export function userHome(): string {
  return process.env.WIREBAY_USER_HOME || os.homedir();
}

/** Where wirebay keeps config, secrets, state, backups and logs. */
export function wirebayHome(): string {
  return process.env.WIREBAY_HOME || path.join(userHome(), ".wirebay");
}

export const homePaths = {
  config: () => path.join(wirebayHome(), "config.json"),
  state: () => path.join(wirebayHome(), "state.json"),
  secrets: () => path.join(wirebayHome(), "secrets.env"),
  servers: () => path.join(wirebayHome(), "servers"),
  tools: () => path.join(wirebayHome(), "tools"),
  credentials: () => path.join(wirebayHome(), "credentials"),
  backups: () => path.join(wirebayHome(), "backups"),
  logs: () => path.join(wirebayHome(), "logs"),
};

/** Root of the installed package (works from both src/core and dist/core). */
export const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

export const packagePaths = {
  presets: path.join(packageRoot, "presets"),
  tools: path.join(packageRoot, "tools"),
  schemas: path.join(packageRoot, "schemas"),
  templates: path.join(packageRoot, "templates"),
};

/** Absolute path of the CLI entry point that tool configs should call. */
export function cliEntryPath(): string {
  const built = path.join(packageRoot, "dist", "cli.js");
  const source = path.join(packageRoot, "src", "cli.ts");
  // Prefer the file we are actually running from.
  const running = fileURLToPath(import.meta.url);
  if (running.endsWith(".ts") && existsSync(source)) return source;
  return existsSync(built) ? built : source;
}

/** True when this process was started from the npx cache (its path is not stable). */
export function runningFromNpx(): boolean {
  return /[\\/]_npx[\\/]/.test(packageRoot);
}

export function currentOs(): "win32" | "darwin" | "linux" {
  const p = process.platform;
  return p === "win32" || p === "darwin" ? p : "linux";
}

/** Pick the value for the current OS from a per-OS object. */
export function pickOs<T>(value: PerOs<T> | undefined, osName = currentOs()): T | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value === "object" && !Array.isArray(value) && ("win32" in value || "darwin" in value || "linux" in value)) {
    return (value as { win32?: T; darwin?: T; linux?: T })[osName];
  }
  return value as T;
}

/**
 * Expand placeholders in a manifest path:
 *   ~ or {home}   user home
 *   {appdata}     %APPDATA% on Windows, ~/Library/Application Support on macOS, ~/.config on Linux
 *   {config}      XDG config dir (~/.config) on Linux/macOS, %APPDATA% on Windows
 *   {cwd}         current working directory (project scope)
 *   ${VAR:-fallback}  environment variable with optional fallback
 */
export function expandPath(p: string, cwd = process.cwd()): string {
  const home = userHome();
  const appdata =
    process.env.WIREBAY_USER_HOME !== undefined
      ? appdataFor(home)
      : process.env.APPDATA || appdataFor(home);
  let out = p.replace(/\$\{([A-Z0-9_]+)(?::-([^}]*))?\}/gi, (_m, name: string, fallback?: string) => {
    const v = process.env[name];
    return v && v.length > 0 ? v : (fallback ?? "");
  });
  out = out
    .replace(/\{home\}/g, home)
    .replace(/\{appdata\}/g, appdata)
    .replace(/\{config\}/g, currentOs() === "win32" ? appdata : path.join(home, ".config"))
    .replace(/\{cwd\}/g, cwd);
  if (out === "~" || out.startsWith("~/") || out.startsWith("~\\")) out = path.join(home, out.slice(1));
  return path.normalize(out);
}

function appdataFor(home: string): string {
  switch (currentOs()) {
    case "win32":
      return path.join(home, "AppData", "Roaming");
    case "darwin":
      return path.join(home, "Library", "Application Support");
    default:
      return path.join(home, ".config");
  }
}

/** Well-known install folders checked when an executable is not on PATH. */
function wellKnownDirs(): string[] {
  const home = userHome();
  if (currentOs() === "win32") {
    return [
      path.join(process.env.ProgramFiles || "C:\\Program Files", "nodejs"),
      path.join(process.env.APPDATA || path.join(home, "AppData", "Roaming"), "npm"),
      path.join(home, ".local", "bin"),
      path.join(home, ".cargo", "bin"),
      path.join(process.env.ProgramFiles || "C:\\Program Files", "Docker", "Docker", "resources", "bin"),
    ];
  }
  return ["/opt/homebrew/bin", "/usr/local/bin", "/usr/bin", "/bin", path.join(home, ".local", "bin"), path.join(home, ".cargo", "bin")];
}

/**
 * Find an executable. Lookup order: captured paths from config, PATH, well-known dirs.
 * Returns an absolute path or undefined.
 */
export function resolveExecutable(cmd: string, captured: Record<string, string> = {}): string | undefined {
  if (path.isAbsolute(cmd)) return isFile(cmd) ? cmd : undefined;
  const fromConfig = captured[cmd];
  if (fromConfig && isFile(fromConfig)) return fromConfig;

  const exts = currentOs() === "win32" ? (process.env.PATHEXT || ".EXE;.CMD;.BAT;.COM").split(";").map((e) => e.toLowerCase()) : [""];
  const dirs = [...(process.env.PATH || process.env.Path || "").split(path.delimiter).filter(Boolean), ...wellKnownDirs()];
  for (const dir of dirs) {
    for (const ext of currentOs() === "win32" && !path.extname(cmd) ? exts : [""]) {
      const candidate = path.join(dir, cmd + ext);
      if (isFile(candidate)) return candidate;
    }
  }
  return undefined;
}

function isFile(p: string): boolean {
  try {
    return statSync(p).isFile();
  } catch {
    return false;
  }
}
