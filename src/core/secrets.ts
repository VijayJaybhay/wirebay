// Central secrets. v1 ships one backend: a dotenv file at ~/.wirebay/secrets.env.
// Other backends (OS keychain, 1Password, …) can implement SecretsBackend later.

import { execFileSync } from "node:child_process";
import { chmodSync, copyFileSync, existsSync, mkdirSync, statSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { parseEnv } from "node:util";
import { readTextIfExists, writeFileAtomic } from "./io.ts";
import { currentOs, homePaths, packagePaths, userHome } from "./paths.ts";

export interface SecretsBackend {
  /** All secrets as KEY → value (empty values are omitted). */
  all(): Record<string, string>;
  get(key: string): string | undefined;
  set(key: string, value: string, section?: string): void;
  unset(key: string): boolean;
  /** Every key present in the store, including empty ones. */
  keys(): string[];
}

const KEY_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;

export function isValidKey(key: string): boolean {
  return KEY_RE.test(key);
}

/** Show enough of a secret to recognise it, never the whole value. */
export function mask(value: string | undefined): string {
  if (!value) return "(empty)";
  if (value.length <= 8) return "•".repeat(value.length);
  if (value.length < 16) return `${value.slice(0, 2)}${"•".repeat(6)}`;
  return `${value.slice(0, 4)}…${value.slice(-4)}`;
}

/** Expand ~ and ${VAR} inside secret values (e.g. file paths to credentials). */
function expandValue(value: string, env: Record<string, string>): string {
  let out = value.replace(/\$\{([A-Za-z_][A-Za-z0-9_]*)\}/g, (_m, name: string) => env[name] ?? process.env[name] ?? "");
  if (out === "~" || out.startsWith("~/") || out.startsWith("~\\")) out = path.join(userHome(), out.slice(1));
  return out;
}

/** Quote a value for the .env file when it needs it. */
function formatValue(value: string): string {
  if (value === "" || /^[A-Za-z0-9_@%+=:,./~\\-]+$/.test(value)) return value;
  if (!value.includes('"') && !value.includes("\n")) return `"${value}"`;
  if (!value.includes("'")) return `'${value}'`;
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n")}"`;
}

export class EnvFileBackend implements SecretsBackend {
  readonly file: string;

  constructor(file = homePaths.secrets()) {
    this.file = file;
  }

  private text(): string {
    return readTextIfExists(this.file) ?? "";
  }

  private raw(): Record<string, string> {
    return parseEnv(this.text()) as Record<string, string>;
  }

  all(): Record<string, string> {
    const raw = this.raw();
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(raw)) {
      if (v !== "") out[k] = expandValue(v, raw);
    }
    return out;
  }

  get(key: string): string | undefined {
    return this.all()[key];
  }

  keys(): string[] {
    return Object.keys(this.raw());
  }

  set(key: string, value: string, section?: string): void {
    if (!isValidKey(key)) throw new Error(`Invalid key name: ${key}`);
    const lines = this.text().split(/\r?\n/);
    const line = `${key}=${formatValue(value)}`;
    const idx = lines.findIndex((l) => new RegExp(`^\\s*(export\\s+)?${key}\\s*=`).test(l));
    if (idx >= 0) {
      lines[idx] = line;
    } else {
      while (lines.length && lines[lines.length - 1] === "") lines.pop();
      if (section) lines.push("", sectionHeader(section));
      lines.push(line);
    }
    this.write(lines.join("\n").replace(/\n*$/, "\n"));
  }

  /** Append empty placeholder keys for a server under its own section header (skips keys that already exist). */
  addPlaceholders(section: string, entries: { key: string; comment?: string }[]): string[] {
    const existing = new Set(this.keys());
    const missing = entries.filter((e) => !existing.has(e.key));
    if (!missing.length) return [];
    const lines = this.text().split(/\r?\n/);
    while (lines.length && lines[lines.length - 1] === "") lines.pop();
    lines.push("", sectionHeader(section));
    for (const e of missing) {
      if (e.comment) lines.push(`# ${e.comment}`);
      lines.push(`${e.key}=`);
    }
    this.write(lines.join("\n") + "\n");
    return missing.map((e) => e.key);
  }

  unset(key: string): boolean {
    const lines = this.text().split(/\r?\n/);
    const idx = lines.findIndex((l) => new RegExp(`^\\s*(export\\s+)?${key}\\s*=`).test(l));
    if (idx < 0) return false;
    lines[idx] = `${key}=`;
    this.write(lines.join("\n"));
    return true;
  }

  private write(content: string): void {
    // Atomic writes replace the file, so its permissions are re-applied every time.
    writeFileAtomic(this.file, content, { mode: 0o600 });
    hardenPermissions(this.file);
  }
}

function sectionHeader(name: string): string {
  return `# ── ${name} ──`;
}

let backend: SecretsBackend | undefined;

export function secrets(): SecretsBackend {
  backend ??= new EnvFileBackend();
  return backend;
}

/** Reset the cached backend (tests change WIREBAY_HOME between cases). */
export function resetSecretsBackend(): void {
  backend = undefined;
}

/** Create ~/.wirebay/secrets.env from the template if it does not exist yet. Returns true when created. */
export function ensureSecretsFile(): boolean {
  const file = homePaths.secrets();
  if (existsSync(file)) return false;
  mkdirSync(path.dirname(file), { recursive: true });
  copyFileSync(path.join(packagePaths.templates, "secrets.env.example"), file);
  hardenPermissions(file);
  return true;
}

/** Restrict a file or folder to the current user (chmod 600/700, or icacls on Windows). */
export function hardenPermissions(target: string): void {
  try {
    if (currentOs() === "win32") {
      const user = process.env.USERNAME || os.userInfo().username;
      const grant = statSync(target).isDirectory() ? `${user}:(OI)(CI)F` : `${user}:F`;
      execFileSync("icacls", [target, "/inheritance:r", "/grant:r", grant], { stdio: "ignore", windowsHide: true });
    } else {
      chmodSync(target, statSync(target).isDirectory() ? 0o700 : 0o600);
    }
  } catch {
    // Best effort: `wirebay doctor` reports files that are still readable by others.
  }
}

/** Returns a warning when the secrets file can be read by other users, otherwise undefined. */
export function checkPermissions(file = homePaths.secrets()): string | undefined {
  if (!existsSync(file)) return undefined;
  try {
    if (currentOs() === "win32") {
      const out = execFileSync("icacls", [file], { encoding: "utf8", windowsHide: true });
      if (/\b(Everyone|BUILTIN\\Users|Authenticated Users)\b/i.test(out)) {
        return `${file} is readable by other users. Fix: icacls "${file}" /inheritance:r /grant:r "%USERNAME%:F"`;
      }
      return undefined;
    }
    const mode = statSync(file).mode & 0o777;
    if (mode & 0o077) return `${file} has permissions ${mode.toString(8)}. Fix: chmod 600 "${file}"`;
  } catch {
    return undefined;
  }
  return undefined;
}
