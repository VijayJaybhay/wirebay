// `wirebay run <server>`: what every tool config calls.
// Builds the child environment from the central secrets (only the keys this server declares),
// resolves the executable, then starts the real MCP server with stdio passed straight through.
// IMPORTANT: stdout belongs to the MCP protocol. Nothing in this file may write to stdout.

import { spawn } from "node:child_process";
import { appendFileSync, existsSync, mkdirSync, renameSync, statSync } from "node:fs";
import path from "node:path";
import { WirebayError } from "./errors.ts";
import { currentOs, homePaths, resolveExecutable } from "./paths.ts";
import { declaredKeys, effectiveLaunch, getServer, requiredKeys } from "./servers.ts";
import { secrets } from "./secrets.ts";
import { loadConfig } from "./store.ts";
import { expand, expandArgs } from "./template.ts";
import type { ServerDef } from "./types.ts";

/** Pinned version of the stdio↔HTTP bridge used for remote servers. */
export const MCP_REMOTE_PACKAGE = "mcp-remote@0.14.3";
export const AUTH_ENV = "WIREBAY_AUTH_HEADER";

export interface LaunchPlan {
  server: string;
  command: string;
  args: string[];
  env: Record<string, string>;
  /** Secret values that must never appear in logs or output. */
  redact: string[];
  /** Windows only: pass args to cmd.exe without re-quoting. */
  verbatim?: boolean;
}

/**
 * Work out exactly what to start, without starting it. Pure apart from executable lookup,
 * so it is easy to test.
 */
export function buildLaunchPlan(
  def: ServerDef,
  secretValues: Record<string, string>,
  baseEnv: NodeJS.ProcessEnv = process.env,
  captured: Record<string, string> = {},
): LaunchPlan {
  const declared = declaredKeys(def);
  const env: Record<string, string> = {};
  for (const [k, v] of Object.entries(baseEnv)) if (v !== undefined) env[k] = v;

  // 1. Declared secrets from the central store (undeclared keys are never added).
  const provided: Record<string, string> = {};
  for (const key of declared) {
    if (secretValues[key] !== undefined && secretValues[key] !== "") provided[key] = secretValues[key];
  }
  Object.assign(env, provided);

  // 2. Default env values from the definition, unless the secrets file overrides them.
  for (const [k, raw] of Object.entries(def.env ?? {})) {
    if (provided[k] !== undefined) continue;
    const value = expand(raw, env);
    if (value !== "") env[k] = value;
    else delete env[k];
  }

  // 3. Required keys must be present.
  const missing = requiredKeys(def).filter((k) => !env[k]);
  if (missing.length) {
    throw new WirebayError(`Server "${def.name}" is missing required secret(s): ${missing.join(", ")}.`, {
      hint: missing.map((k) => `wirebay secrets set ${k}`).join("\n"),
    });
  }

  const redact = Object.values(provided).filter((v) => v.length >= 4);
  const launch = effectiveLaunch(def);

  if (launch.type === "stdio") {
    const resolved = resolveExecutable(launch.command, captured);
    if (!resolved) throw missingExecutable(launch.command, def.name);
    return { server: def.name, ...toSpawnable(resolved, expandArgs(launch.args, env)), env, redact };
  }

  // Remote server: bridge through mcp-remote. The token goes in the child env, never in argv.
  const url = expand(launch.url, env);
  const args = ["-y", MCP_REMOTE_PACKAGE, url];
  for (const [name, rawValue] of Object.entries(launch.headers ?? {})) {
    const value = expand(rawValue, env);
    if (value) args.push("--header", `${name}:${value}`);
  }
  const auth = launch.auth;
  if (auth && (auth.type === "bearer" || auth.type === "header")) {
    const token = env[auth.secret];
    if (!token) throw new WirebayError(`Server "${def.name}" needs ${auth.secret}.`, { hint: `wirebay secrets set ${auth.secret}` });
    const header = auth.type === "bearer" ? "Authorization" : auth.header;
    const prefix = auth.type === "bearer" ? "Bearer " : (auth.prefix ?? "");
    env[AUTH_ENV] = `${prefix}${token}`;
    redact.push(env[AUTH_ENV]);
    args.push("--header", `${header}:\${${AUTH_ENV}}`);
  }
  const npx = resolveExecutable("npx", captured);
  if (!npx) throw missingExecutable("npx", def.name);
  return { server: def.name, ...toSpawnable(npx, args), env, redact };
}

function missingExecutable(cmd: string, server: string): WirebayError {
  const install: Record<string, string> = {
    npx: "Install Node.js (https://nodejs.org), which provides npx.",
    uvx: "Install uv (https://docs.astral.sh/uv/getting-started/installation/), which provides uvx.",
    docker: "Install Docker Desktop (https://www.docker.com/products/docker-desktop/).",
  };
  return new WirebayError(`Cannot find "${cmd}" (needed by server "${server}").`, {
    hint: `${install[cmd] ?? `Install ${cmd}.`} If it is installed, run \`wirebay init\` from a terminal where \`${cmd}\` works so wirebay can remember its path.`,
  });
}

/**
 * On Windows, .cmd/.bat shims cannot be spawned directly without a shell.
 * npx is run through Node + npx-cli.js (no shell at all); other shims go through cmd.exe with escaping.
 */
export function toSpawnable(resolved: string, args: string[]): { command: string; args: string[]; verbatim?: boolean } {
  if (currentOs() !== "win32" || !/\.(cmd|bat)$/i.test(resolved)) return { command: resolved, args };

  const dir = path.dirname(resolved);
  const base = path.basename(resolved).toLowerCase();
  if (base === "npx.cmd" || base === "npm.cmd") {
    const script = path.join(dir, "node_modules", "npm", "bin", base === "npx.cmd" ? "npx-cli.js" : "npm-cli.js");
    const node = existsSync(path.join(dir, "node.exe")) ? path.join(dir, "node.exe") : process.execPath;
    if (existsSync(script)) return { command: node, args: [script, ...args] };
  }
  const line = [escapeCmdCommand(resolved), ...args.map(escapeCmdArg)].join(" ");
  return { command: process.env.ComSpec || "cmd.exe", args: ["/d", "/s", "/c", `"${line}"`], verbatim: true };
}

const CMD_META = /([()\][%!^"`<>&|;, *?])/g;

function escapeCmdCommand(cmd: string): string {
  return cmd.replace(CMD_META, "^$1");
}

function escapeCmdArg(arg: string): string {
  // Quote for CommandLineToArgvW, then escape cmd.exe metacharacters (twice: .cmd shims re-parse).
  let quoted = `"${arg.replace(/(\\*)"/g, '$1$1\\"').replace(/(\\*)$/, "$1$1")}"`;
  quoted = quoted.replace(CMD_META, "^$1");
  return quoted.replace(CMD_META, "^$1");
}

/** Replace every secret value in a string with a mask. */
export function redactText(text: string, redact: string[]): string {
  let out = text;
  for (const secret of redact) out = out.split(secret).join("‹redacted›");
  return out;
}

const MAX_LOG_BYTES = 1_000_000;

export function logLine(server: string, message: string, redact: string[] = []): void {
  try {
    const dir = homePaths.logs();
    mkdirSync(dir, { recursive: true });
    const file = path.join(dir, `${server}.log`);
    if (existsSync(file) && statSync(file).size > MAX_LOG_BYTES) {
      for (let i = 2; i >= 1; i--) {
        if (existsSync(`${file}.${i}`)) renameSync(`${file}.${i}`, `${file}.${i + 1}`);
      }
      renameSync(file, `${file}.1`);
    }
    appendFileSync(file, `${new Date().toISOString()} ${redactText(message, redact)}\n`);
  } catch {
    // Logging must never break the server.
  }
}

/** Start the server and mirror its exit code. Resolves only if the process is not exited by the caller. */
export async function runServer(name: string): Promise<number> {
  let plan: LaunchPlan;
  try {
    const config = loadConfig();
    plan = buildLaunchPlan(getServer(name), secrets().all(), process.env, config.paths);
  } catch (err) {
    const e = err as WirebayError;
    process.stderr.write(`[wirebay] ${e.message}\n${e.hint ? `[wirebay] ${e.hint.replace(/\n/g, "\n[wirebay] ")}\n` : ""}`);
    logLine(name, `failed to start: ${e.message}`);
    return 1;
  }

  logLine(name, `start: ${plan.command} ${plan.args.join(" ")}`, plan.redact);
  const child = spawn(plan.command, plan.args, {
    stdio: "inherit",
    env: plan.env,
    windowsHide: true,
    windowsVerbatimArguments: plan.verbatim ?? false,
  });

  const forward = (signal: NodeJS.Signals) => () => {
    if (!child.killed) child.kill(signal);
  };
  for (const sig of ["SIGINT", "SIGTERM", "SIGHUP"] as NodeJS.Signals[]) {
    if (currentOs() !== "win32" || sig !== "SIGHUP") process.on(sig, forward(sig));
  }

  return new Promise((resolve) => {
    child.on("error", (err) => {
      process.stderr.write(`[wirebay] could not start ${name}: ${redactText(err.message, plan.redact)}\n`);
      logLine(name, `spawn error: ${err.message}`, plan.redact);
      resolve(1);
    });
    child.on("exit", (code, signal) => {
      logLine(name, `exit: code=${code} signal=${signal ?? ""}`);
      resolve(code ?? (signal ? 1 : 0));
    });
  });
}
