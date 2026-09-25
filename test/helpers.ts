// Test helpers: an isolated fake home per test, and a way to run the CLI in it.
// Tests never read or write the real ~/.wirebay or real tool configs.

import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { resetSecretsBackend } from "../src/core/secrets.ts";

export const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const cliPath = path.join(repoRoot, "src", "cli.ts");
export const fakeServer = path.join(repoRoot, "test", "fixtures", "fake-mcp-server.ts");

export interface Sandbox {
  root: string;
  home: string;
  wirebayHome: string;
  env: NodeJS.ProcessEnv;
  cleanup(): void;
}

/** Create a fake user home and point WIREBAY_USER_HOME / WIREBAY_HOME at it (also for this process). */
export function sandbox(): Sandbox {
  const root = mkdtempSync(path.join(os.tmpdir(), "wirebay-test-"));
  const home = path.join(root, "home");
  const wirebayHome = path.join(home, ".wirebay");
  mkdirSync(home, { recursive: true });
  const previous = { user: process.env.WIREBAY_USER_HOME, home: process.env.WIREBAY_HOME };
  process.env.WIREBAY_USER_HOME = home;
  process.env.WIREBAY_HOME = wirebayHome;
  resetSecretsBackend();
  const env = { ...process.env, WIREBAY_USER_HOME: home, WIREBAY_HOME: wirebayHome, NO_COLOR: "1", CI: "1" };
  return {
    root,
    home,
    wirebayHome,
    env,
    cleanup() {
      if (previous.user === undefined) delete process.env.WIREBAY_USER_HOME;
      else process.env.WIREBAY_USER_HOME = previous.user;
      if (previous.home === undefined) delete process.env.WIREBAY_HOME;
      else process.env.WIREBAY_HOME = previous.home;
      resetSecretsBackend();
      rmSync(root, { recursive: true, force: true });
    },
  };
}

export function runCli(sb: Sandbox, args: string[], input?: string): { code: number; stdout: string; stderr: string } {
  const r = spawnSync(process.execPath, ["--no-warnings", cliPath, ...args], {
    env: sb.env,
    cwd: sb.root,
    input,
    encoding: "utf8",
    timeout: 60_000,
  });
  return { code: r.status ?? -1, stdout: r.stdout, stderr: r.stderr };
}
