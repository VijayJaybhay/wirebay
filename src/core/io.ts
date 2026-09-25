// Safe file IO for tool config files: atomic writes, backups before every write,
// and a check that the file did not change between reading and writing.

import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { WirebayError } from "./errors.ts";
import { homePaths } from "./paths.ts";

const MAX_BACKUPS_PER_TOOL = 20;

export function readTextIfExists(file: string): string | undefined {
  try {
    return readFileSync(file, "utf8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw err;
  }
}

export function readJsonIfExists<T>(file: string): T | undefined {
  const text = readTextIfExists(file);
  if (text === undefined) return undefined;
  try {
    return JSON.parse(text) as T;
  } catch (err) {
    throw new WirebayError(`Could not parse ${file}: ${(err as Error).message}`, {
      hint: "Fix the JSON syntax, or restore a backup with `wirebay restore`.",
    });
  }
}

export function mtimeOf(file: string): number | undefined {
  try {
    return statSync(file).mtimeMs;
  } catch {
    return undefined;
  }
}

/** Write a file atomically: write a temp file next to it, then rename over the original. */
export function writeFileAtomic(file: string, content: string, opts: { expectedMtime?: number; mode?: number } = {}): void {
  mkdirSync(path.dirname(file), { recursive: true });
  if (opts.expectedMtime !== undefined) {
    const now = mtimeOf(file);
    if (now !== undefined && now !== opts.expectedMtime) {
      throw new WirebayError(`${file} changed while wirebay was working on it.`, {
        hint: "Another program (probably the tool itself) just wrote to it. Run the command again.",
      });
    }
  }
  const tmp = `${file}.wirebay-${process.pid}-${Date.now()}.tmp`;
  writeFileSync(tmp, content, { encoding: "utf8", mode: opts.mode });
  try {
    renameSync(tmp, file);
  } catch (err) {
    rmSync(tmp, { force: true });
    throw err;
  }
}

export function writeJson(file: string, value: unknown, opts: { mode?: number } = {}): void {
  writeFileAtomic(file, JSON.stringify(value, null, 2) + "\n", opts);
}

function backupDir(toolId: string): string {
  return path.join(homePaths.backups(), toolId);
}

function timestamp(): string {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

/**
 * Copy a tool config file into ~/.wirebay/backups/<tool>/ and keep the newest 20.
 * Each backup is "<timestamp>__<file name>" plus a ".meta.json" that records the original path.
 */
export function backupFile(toolId: string, file: string): string | undefined {
  if (!existsSync(file)) return undefined;
  const dir = backupDir(toolId);
  mkdirSync(dir, { recursive: true });
  const dest = path.join(dir, `${timestamp()}__${path.basename(file)}`);
  copyFileSync(file, dest);
  writeFileSync(dest + META, JSON.stringify({ originalPath: path.resolve(file) }));
  pruneBackups(dir);
  return dest;
}

const META = ".meta.json";

function backupNames(dir: string): string[] {
  return readdirSync(dir)
    .filter((n) => !n.endsWith(META))
    .sort();
}

function pruneBackups(dir: string): void {
  const names = backupNames(dir);
  for (const old of names.slice(0, Math.max(0, names.length - MAX_BACKUPS_PER_TOOL))) {
    rmSync(path.join(dir, old), { force: true });
    rmSync(path.join(dir, old + META), { force: true });
  }
}

export interface BackupInfo {
  id: string;
  tool: string;
  createdAt: string;
  originalPath: string;
  backupPath: string;
}

export function listBackups(toolId: string): BackupInfo[] {
  const dir = backupDir(toolId);
  if (!existsSync(dir)) return [];
  return backupNames(dir)
    .reverse()
    .map((name) => {
      const meta = readJsonIfExists<{ originalPath?: string }>(path.join(dir, name + META));
      return {
        id: name,
        tool: toolId,
        createdAt: name.split("__")[0] ?? "",
        originalPath: meta?.originalPath ?? "",
        backupPath: path.join(dir, name),
      };
    });
}
