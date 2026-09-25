/**
 * Safe reads and writes for files wirebay does not own (tool configs) and files it does
 * (config, state, secrets).
 * @module
 */

import { mkdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { ConfigParseError, WirebayError } from "../errors.ts";

/** Options for {@link SafeFileWriter.write}. */
export interface WriteOptions {
  /**
   * The file's modification time when it was read. If the file changed since then
   * (for example, the tool wrote to it), the write is refused.
   */
  expectedMtime?: number;
  /** File mode for newly created files, e.g. `0o600`. */
  mode?: number;
}

/**
 * Reads files and writes them atomically: the content goes to a temporary file next to the
 * target, which is then renamed over it, so a crash never leaves a half-written config.
 */
export class SafeFileWriter {
  /**
   * Read a text file.
   * @returns The content, or `undefined` when the file does not exist.
   */
  read(file: string): string | undefined {
    try {
      return readFileSync(file, "utf8");
    } catch (err) {
      // ENOTDIR: a parent path is a file (Linux/macOS report this where Windows says ENOENT).
      const code = (err as NodeJS.ErrnoException).code;
      if (code === "ENOENT" || code === "ENOTDIR") return undefined;
      throw err;
    }
  }

  /**
   * Read and parse a JSON file.
   * @returns The parsed value, or `undefined` when the file does not exist.
   * @throws {@link core/errors!ConfigParseError} when the file is not valid JSON.
   */
  readJson<T>(file: string): T | undefined {
    const text = this.read(file);
    if (text === undefined) return undefined;
    try {
      return JSON.parse(text) as T;
    } catch (err) {
      throw new ConfigParseError(file, (err as Error).message);
    }
  }

  /** The file's modification time in milliseconds, or `undefined` when it doesn't exist. */
  mtime(file: string): number | undefined {
    try {
      return statSync(file).mtimeMs;
    } catch {
      return undefined;
    }
  }

  /**
   * Write a file atomically, creating parent folders as needed.
   * @throws {@link core/errors!WirebayError} when `expectedMtime` is given and the file changed meanwhile.
   */
  write(file: string, content: string, options: WriteOptions = {}): void {
    mkdirSync(path.dirname(file), { recursive: true });
    if (options.expectedMtime !== undefined) {
      const now = this.mtime(file);
      if (now !== undefined && now !== options.expectedMtime) {
        throw new WirebayError(`${file} changed while wirebay was working on it.`, {
          hint: "Another program (probably the tool itself) just wrote to it. Run the command again.",
        });
      }
    }
    const tmp = `${file}.wirebay-${process.pid}-${Date.now()}.tmp`;
    writeFileSync(tmp, content, { encoding: "utf8", mode: options.mode });
    try {
      renameSync(tmp, file);
    } catch (err) {
      rmSync(tmp, { force: true });
      throw err;
    }
  }

  /** Write a value as pretty-printed JSON (atomically). */
  writeJson(file: string, value: unknown, options: WriteOptions = {}): void {
    this.write(file, JSON.stringify(value, null, 2) + "\n", options);
  }
}
