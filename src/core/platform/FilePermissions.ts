/**
 * Restricting files to the current user (`chmod 600/700`, or a Windows ACL) and checking that
 * they stay that way.
 * @module
 */

import { execFileSync } from "node:child_process";
import { chmodSync, existsSync, statSync } from "node:fs";
import os from "node:os";
import { type OsName, WirebayPaths } from "./WirebayPaths.ts";

/** Owner-only permissions for secrets and credentials. */
export class FilePermissions {
  private readonly os: OsName;
  private readonly user: string;

  /**
   * @param osName - Target OS (defaults to the current one).
   * @param user - Account to grant access to on Windows (defaults to the current user).
   */
  constructor(osName: OsName = WirebayPaths.detectOs(), user: string = os.userInfo().username) {
    this.os = osName;
    this.user = user;
  }

  /**
   * Make a file or folder readable only by the current user. Best effort: failures are ignored,
   * and {@link FilePermissions.check} reports anything that is still too open.
   */
  restrict(target: string): void {
    try {
      const isDir = statSync(target).isDirectory();
      if (this.os === "win32") {
        const grant = isDir ? `${this.user}:(OI)(CI)F` : `${this.user}:F`;
        execFileSync("icacls", [target, "/inheritance:r", "/grant:r", grant], { stdio: "ignore", windowsHide: true });
      } else {
        chmodSync(target, isDir ? 0o700 : 0o600);
      }
    } catch {
      // Best effort: `wirebay doctor` reports files that are still readable by others.
    }
  }

  /**
   * Check that a file is not readable by other users.
   * @returns A warning with the fix, or `undefined` when the file is private (or missing).
   */
  check(file: string): string | undefined {
    if (!existsSync(file)) return undefined;
    try {
      if (this.os === "win32") {
        const acl = execFileSync("icacls", [file], { encoding: "utf8", windowsHide: true });
        if (/\b(Everyone|BUILTIN\\Users|Authenticated Users)\b/i.test(acl)) {
          return `${file} is readable by other users. Fix: icacls "${file}" /inheritance:r /grant:r "%USERNAME%:F"`;
        }
        return undefined;
      }
      const mode = statSync(file).mode & 0o777;
      return (mode & 0o077) !== 0 ? `${file} has permissions ${mode.toString(8)}. Fix: chmod 600 "${file}"` : undefined;
    } catch {
      return undefined;
    }
  }
}
