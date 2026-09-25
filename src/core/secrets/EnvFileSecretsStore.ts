/**
 * The v1 secrets store: a dotenv file (`~/.wirebay/secrets.env`) readable only by the user.
 * @module
 */

import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { parseEnv } from "node:util";
import type { SafeFileWriter } from "../io/SafeFileWriter.ts";
import { FilePermissions } from "../platform/FilePermissions.ts";
import { WirebayPaths } from "../platform/WirebayPaths.ts";
import type { SecretsBackend } from "./SecretsBackend.ts";

/**
 * Secrets in a dotenv file. Editing keeps comments, order and other keys intact; values that
 * need it are quoted; `~` and `${OTHER_KEY}` are expanded when read.
 */
export class EnvFileSecretsStore implements SecretsBackend {
  private static readonly keyPattern = /^[A-Za-z_][A-Za-z0-9_]*$/;

  readonly location: string;
  private readonly writer: SafeFileWriter;
  private readonly paths: WirebayPaths;
  private readonly permissions = new FilePermissions();

  /**
   * @param paths - Locates the file and the user's home for `~` expansion.
   * @param writer - Used for atomic writes.
   * @param file - Override the file location (defaults to `paths.secretsFile`).
   */
  constructor(paths: WirebayPaths, writer: SafeFileWriter, file: string = paths.secretsFile) {
    this.paths = paths;
    this.writer = writer;
    this.location = file;
  }

  /** True for names usable as keys: letters, digits and underscores, not starting with a digit. */
  static isValidKey(key: string): boolean {
    return EnvFileSecretsStore.keyPattern.test(key);
  }

  all(): Record<string, string> {
    const raw = this.raw();
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(raw)) if (v !== "") out[k] = this.expandValue(v, raw);
    return out;
  }

  get(key: string): string | undefined {
    return this.all()[key];
  }

  keys(): string[] {
    return Object.keys(this.raw());
  }

  set(key: string, value: string, section?: string): void {
    if (!EnvFileSecretsStore.isValidKey(key)) throw new Error(`Invalid key name: ${key}`);
    const lines = this.text().split(/\r?\n/);
    const line = `${key}=${EnvFileSecretsStore.formatValue(value)}`;
    const index = this.lineIndexOf(lines, key);
    if (index >= 0) {
      lines[index] = line;
    } else {
      EnvFileSecretsStore.trimTrailingBlank(lines);
      if (section) lines.push("", EnvFileSecretsStore.header(section));
      lines.push(line);
    }
    this.save(lines.join("\n").replace(/\n*$/, "\n"));
  }

  unset(key: string): boolean {
    const lines = this.text().split(/\r?\n/);
    const index = this.lineIndexOf(lines, key);
    if (index < 0) return false;
    lines[index] = `${key}=`;
    this.save(lines.join("\n"));
    return true;
  }

  addPlaceholders(section: string, entries: { key: string; comment?: string }[]): string[] {
    const existing = new Set(this.keys());
    const missing = entries.filter((e) => !existing.has(e.key));
    if (!missing.length) return [];
    const lines = this.text().split(/\r?\n/);
    EnvFileSecretsStore.trimTrailingBlank(lines);
    lines.push("", EnvFileSecretsStore.header(section));
    for (const e of missing) {
      if (e.comment) lines.push(`# ${e.comment}`);
      lines.push(`${e.key}=`);
    }
    this.save(lines.join("\n") + "\n");
    return missing.map((e) => e.key);
  }

  ensureExists(): boolean {
    if (existsSync(this.location)) return false;
    mkdirSync(path.dirname(this.location), { recursive: true });
    copyFileSync(WirebayPaths.packagePath("templates", "secrets.env.example"), this.location);
    this.permissions.restrict(this.location);
    return true;
  }

  private text(): string {
    return this.writer.read(this.location) ?? "";
  }

  private raw(): Record<string, string> {
    return parseEnv(this.text()) as Record<string, string>;
  }

  private save(content: string): void {
    // Atomic writes replace the file, so permissions are re-applied every time.
    this.writer.write(this.location, content, { mode: 0o600 });
    this.permissions.restrict(this.location);
  }

  private lineIndexOf(lines: string[], key: string): number {
    const re = new RegExp(`^\\s*(export\\s+)?${key}\\s*=`);
    return lines.findIndex((l) => re.test(l));
  }

  private expandValue(value: string, raw: Record<string, string>): string {
    let out = value.replace(/\$\{([A-Za-z_][A-Za-z0-9_]*)\}/g, (_m, name: string) => raw[name] ?? process.env[name] ?? "");
    if (out === "~" || out.startsWith("~/") || out.startsWith("~\\")) out = path.join(this.paths.userHome, out.slice(1));
    return out;
  }

  private static header(section: string): string {
    return `# ── ${section} ──`;
  }

  private static trimTrailingBlank(lines: string[]): void {
    while (lines.length && lines[lines.length - 1] === "") lines.pop();
  }

  /** Quote a value for the file when it needs it. */
  private static formatValue(value: string): string {
    if (value === "" || /^[A-Za-z0-9_@%+=:,./~\\-]+$/.test(value)) return value;
    if (!value.includes('"') && !value.includes("\n")) return `"${value}"`;
    if (!value.includes("'")) return `'${value}'`;
    return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n")}"`;
  }
}
