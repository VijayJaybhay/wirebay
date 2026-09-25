/**
 * Restricting files to the current user (`chmod 600/700`, or a Windows ACL) and checking that
 * they stay that way.
 * @module
 */

import { execFileSync } from "node:child_process";
import { chmodSync, existsSync, statSync } from "node:fs";
import os from "node:os";
import { WirebayPaths } from "./WirebayPaths.ts";

/** Owner-only file permissions for secrets and credentials. */
export class FilePermissions {
  /**
   * Make a file or folder readable only by the current user. Best effort: failures are ignored,
   * and {@link FilePermissions.check} reports anything that is still too open.
   * @param target - File or folder to restrict.
   */
  static restrict(target: string): void {
    try {
      const isDir = statSync(target).isDirectory();
      if (WirebayPaths.detectOs() === "win32") {
        const user = process.env.USERNAME || os.userInfo().username;
        const grant = isDir ? `${user}:(OI)(CI)F` : `${user}:F`;
        execFileSync("icacls", [target, "/inheritance:r", "/grant:r", grant], { stdio: "ignore", windowsHide: true });
      } else {
        chmodSync(target, isDir ? 0o700 : 0o600);
      }
    } catch {
      // Best effort; `wirebay doctor` reports the result.
    }
  }

  /**
   * Check that a file is not readable by other users.
   * @param file - File to check.
   * @returns A warning with the fix, or `undefined` when the file is private (or missing).
   */
  static check(file: string): string | undefined {
    if (!existsSync(file)) return undefined;
    try {
      if (WirebayPaths.detectOs() === "win32") {
        const acl = execFileSync("icacls", [file], { encoding: "utf8", windowsHide: true });
        if (/\b(Everyone|BUILTIN\\Users|Authenticated Users)\b/i.test(acl)) {
          return `${file} is readable by other users. Fix: icacls "${file}" /inheritance:r /grant:r "%USERNAME%:F"`;
        }
        return undefined;
      }
      const mode = statSync(file).mode & 0o777;
      return mode & 0o077 ? `${file} has permissions ${mode.toString(8)}. Fix: chmod 600 "${file}"` : undefined;
    } catch {
      return undefined;
    }
  }
}
