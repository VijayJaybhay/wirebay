/**
 * Launcher logs in `~/.wirebay/logs/<server>.log`, with secrets redacted and simple rotation.
 * @module
 */

import { appendFileSync, existsSync, mkdirSync, renameSync, statSync } from "node:fs";
import path from "node:path";
import type { WirebayPaths } from "../platform/WirebayPaths.ts";
import { SecretMasker } from "../secrets/SecretsBackend.ts";

/** Appends to per-server log files. Logging must never break a server, so all errors are swallowed. */
export class LaunchLogger {
  /** Rotate a log file when it exceeds this size. */
  static readonly maxBytes = 1_000_000;
  /** Number of rotated files kept (`.1` … `.3`). */
  static readonly keep = 3;

  private readonly paths: WirebayPaths;
  private readonly masker = new SecretMasker();

  constructor(paths: WirebayPaths) {
    this.paths = paths;
  }

  /**
   * Append one line.
   * @param server - Server name (the log file name).
   * @param message - Text to log.
   * @param redact - Secret values to hide.
   */
  log(server: string, message: string, redact: string[] = []): void {
    try {
      mkdirSync(this.paths.logsDir, { recursive: true });
      const file = path.join(this.paths.logsDir, `${server}.log`);
      if (existsSync(file) && statSync(file).size > LaunchLogger.maxBytes) this.rotate(file);
      appendFileSync(file, `${new Date().toISOString()} ${this.masker.redact(message, redact)}\n`);
    } catch {
      // Never let logging break a server.
    }
  }

  private rotate(file: string): void {
    const rotated = (n: number): string => `${file}.${String(n)}`;
    for (let i = LaunchLogger.keep - 1; i >= 1; i--) if (existsSync(rotated(i))) renameSync(rotated(i), rotated(i + 1));
    renameSync(file, rotated(1));
  }
}
