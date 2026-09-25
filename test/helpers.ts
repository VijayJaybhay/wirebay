/**
 * Test helpers: an isolated fake home per test, an {@link AppContext} bound to it, and a way to
 * run the real CLI in it. Tests never read or write the real ~/.wirebay or real tool configs.
 * @module
 */

import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { AppContext } from "../src/app/AppContext.ts";

export const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const cliPath = path.join(repoRoot, "src", "cli.ts");
export const fakeServer = path.join(repoRoot, "test", "fixtures", "fake-mcp-server.ts");

/** A temporary home folder and helpers bound to it. */
export class Sandbox {
  readonly root: string;
  readonly home: string;
  readonly wirebayHome: string;
  readonly env: NodeJS.ProcessEnv;

  constructor() {
    this.root = mkdtempSync(path.join(os.tmpdir(), "wirebay-test-"));
    this.home = path.join(this.root, "home");
    this.wirebayHome = path.join(this.home, ".wirebay");
    mkdirSync(this.home, { recursive: true });
    this.env = { ...process.env, WIREBAY_USER_HOME: this.home, WIREBAY_HOME: this.wirebayHome, NO_COLOR: "1", CI: "1" };
  }

  /** A fresh service container that only sees this sandbox. */
  context(): AppContext {
    return new AppContext({ env: this.env, cwd: this.root });
  }

  /** Run the real CLI in this sandbox. */
  run(args: string[], input?: string): { code: number; stdout: string; stderr: string } {
    const r = spawnSync(process.execPath, ["--no-warnings", cliPath, ...args], {
      env: this.env,
      cwd: this.root,
      input,
      encoding: "utf8",
      timeout: 60_000,
    });
    return { code: r.status ?? -1, stdout: r.stdout, stderr: r.stderr };
  }

  /** Delete the sandbox. */
  cleanup(): void {
    rmSync(this.root, { recursive: true, force: true });
  }
}

/** Run `fn` with a fresh sandbox that is always cleaned up. */
export async function withSandbox<T>(fn: (sb: Sandbox) => T | Promise<T>): Promise<T> {
  const sb = new Sandbox();
  try {
    return await fn(sb);
  } finally {
    sb.cleanup();
  }
}
