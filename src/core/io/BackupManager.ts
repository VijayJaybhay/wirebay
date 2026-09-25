/**
 * Backups of tool config files, taken before every write, and restore.
 * @module
 */

import { copyFileSync, existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { WirebayPaths } from "../platform/WirebayPaths.ts";
import type { SafeFileWriter } from "./SafeFileWriter.ts";

/** One stored backup. */
export interface BackupInfo {
  /** Stable identifier, `<timestamp>__<file name>`. */
  id: string;
  /** Tool the backup belongs to. */
  tool: string;
  /** When the backup was taken (ISO-like, filesystem-safe). */
  createdAt: string;
  /** The file this is a copy of. */
  originalPath: string;
  /** Where the copy is stored. */
  backupPath: string;
}

/**
 * Keeps the newest {@link BackupManager.maxPerTool} copies of each tool's config files under
 * `~/.wirebay/backups/<tool>/`, each with a small `.meta.json` recording where it came from.
 */
export class BackupManager {
  /** How many backups are kept per tool. */
  static readonly maxPerTool = 20;
  private static readonly metaSuffix = ".meta.json";

  private readonly paths: WirebayPaths;
  private readonly writer: SafeFileWriter;

  /**
   * @param paths - Locates the backups folder.
   * @param writer - Used to read backup metadata.
   */
  constructor(paths: WirebayPaths, writer: SafeFileWriter) {
    this.paths = paths;
    this.writer = writer;
  }

  /**
   * Copy a file into the tool's backup folder.
   * @returns The backup's path, or `undefined` when the file does not exist yet.
   */
  backup(toolId: string, file: string): string | undefined {
    if (!existsSync(file)) return undefined;
    const dir = this.dirFor(toolId);
    mkdirSync(dir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const dest = path.join(dir, `${stamp}__${path.basename(file)}`);
    copyFileSync(file, dest);
    writeFileSync(dest + BackupManager.metaSuffix, JSON.stringify({ originalPath: path.resolve(file) }));
    this.prune(dir);
    return dest;
  }

  /** All backups for a tool, newest first. */
  list(toolId: string): BackupInfo[] {
    const dir = this.dirFor(toolId);
    if (!existsSync(dir)) return [];
    return this.names(dir)
      .reverse()
      .map((name) => {
        const meta = this.writer.readJson<{ originalPath?: string }>(path.join(dir, name + BackupManager.metaSuffix));
        return {
          id: name,
          tool: toolId,
          createdAt: name.split("__")[0] ?? "",
          originalPath: meta?.originalPath ?? "",
          backupPath: path.join(dir, name),
        };
      });
  }

  /**
   * Put a backup back in place. The current file is backed up first, so a restore can be undone.
   * @returns The backup of the file that was replaced, if there was one.
   */
  restore(backup: BackupInfo): string | undefined {
    const safety = this.backup(backup.tool, backup.originalPath);
    copyFileSync(backup.backupPath, backup.originalPath);
    return safety;
  }

  private dirFor(toolId: string): string {
    return path.join(this.paths.backupsDir, toolId);
  }

  private names(dir: string): string[] {
    return readdirSync(dir)
      .filter((n) => !n.endsWith(BackupManager.metaSuffix))
      .sort();
  }

  private prune(dir: string): void {
    const names = this.names(dir);
    for (const old of names.slice(0, Math.max(0, names.length - BackupManager.maxPerTool))) {
      rmSync(path.join(dir, old), { force: true });
      rmSync(path.join(dir, old + BackupManager.metaSuffix), { force: true });
    }
  }
}
