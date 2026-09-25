/**
 * Works out exactly how to start a server (command, args, environment) without starting it.
 * @module
 */

import { WirebayError } from "../errors.ts";
import type { ExecutableResolver } from "../platform/ExecutableResolver.ts";
import type { ServerDefinition } from "../servers/ServerDefinition.ts";
import { TemplateExpander } from "../template/TemplateExpander.ts";
import { ProcessCommand, type SpawnSpec } from "./ProcessCommand.ts";

/** Everything needed to start one server. */
export interface LaunchPlan extends SpawnSpec {
  server: string;
  /** The child's environment. */
  env: Record<string, string>;
  /** Secret values that must never appear in logs or output. */
  redact: string[];
}

/**
 * Builds launch plans. The core security rule lives here: a server receives **only** the keys it
 * declares from the secrets store, and remote-server tokens go through the environment of the
 * `mcp-remote` bridge, never through argv.
 */
export class LaunchPlanner {
  /** Pinned stdio↔HTTP bridge used for remote servers. */
  static readonly mcpRemotePackage = "mcp-remote@0.14.3";
  /** Env var carrying the auth header value to mcp-remote. */
  static readonly authEnv = "WIREBAY_AUTH_HEADER";

  private readonly resolver: ExecutableResolver;

  /** @param resolver - Finds `npx`, `uvx`, `docker`, … */
  constructor(resolver: ExecutableResolver) {
    this.resolver = resolver;
  }

  /**
   * Plan how to start a server.
   * @param server - The server definition.
   * @param secretValues - All values from the secrets store.
   * @param baseEnv - The environment the tool started us with (PATH, HOME, …).
   * @throws {@link core/errors!WirebayError} when a required secret or the executable is missing.
   */
  plan(server: ServerDefinition, secretValues: Record<string, string>, baseEnv: NodeJS.ProcessEnv): LaunchPlan {
    const env: Record<string, string> = {};
    for (const [k, v] of Object.entries(baseEnv)) if (v !== undefined) env[k] = v;

    // 1. Declared secrets only.
    const provided: Record<string, string> = {};
    for (const key of server.declaredKeys()) if (secretValues[key]) provided[key] = secretValues[key];
    Object.assign(env, provided);

    // 2. Default env values, unless the secrets store overrides them.
    for (const [k, raw] of Object.entries(server.env)) {
      if (provided[k] !== undefined) continue;
      const value = TemplateExpander.expand(raw, env);
      if (value !== "") env[k] = value;
      else delete env[k];
    }

    // 3. Required keys must be present.
    const missing = server.requiredKeys().filter((k) => !env[k]);
    if (missing.length) {
      throw new WirebayError(`Server "${server.name}" is missing required secret(s): ${missing.join(", ")}.`, {
        hint: missing.map((k) => `wirebay secrets set ${k}`).join("\n"),
      });
    }

    const redact = Object.values(provided).filter((v) => v.length >= 4);
    const launch = server.launch;
    if (launch.type === "stdio") {
      const exe = this.require(launch.command, server.name);
      return { server: server.name, ...ProcessCommand.forExecutable(exe, TemplateExpander.expandArgs(launch.args, env)), env, redact };
    }

    // Remote: bridge through mcp-remote; the token travels in the environment, not argv.
    const args = ["-y", LaunchPlanner.mcpRemotePackage, TemplateExpander.expand(launch.url, env)];
    for (const [name, raw] of Object.entries(launch.headers ?? {})) {
      const value = TemplateExpander.expand(raw, env);
      if (value) args.push("--header", `${name}:${value}`);
    }
    const auth = launch.auth;
    if (auth && (auth.type === "bearer" || auth.type === "header")) {
      const token = env[auth.secret];
      if (!token) throw new WirebayError(`Server "${server.name}" needs ${auth.secret}.`, { hint: `wirebay secrets set ${auth.secret}` });
      const header = auth.type === "bearer" ? "Authorization" : auth.header;
      const prefix = auth.type === "bearer" ? "Bearer " : (auth.prefix ?? "");
      env[LaunchPlanner.authEnv] = `${prefix}${token}`;
      redact.push(env[LaunchPlanner.authEnv]);
      args.push("--header", `${header}:\${${LaunchPlanner.authEnv}}`);
    }
    const npx = this.require("npx", server.name);
    return { server: server.name, ...ProcessCommand.forExecutable(npx, args), env, redact };
  }

  private require(command: string, server: string): string {
    const found = this.resolver.resolve(command);
    if (found) return found;
    const install: Record<string, string> = {
      npx: "Install Node.js (https://nodejs.org), which provides npx.",
      uvx: "Install uv (https://docs.astral.sh/uv/getting-started/installation/), which provides uvx.",
      docker: "Install Docker Desktop (https://www.docker.com/products/docker-desktop/).",
    };
    throw new WirebayError(`Cannot find "${command}" (needed by server "${server}").`, {
      hint: `${install[command] ?? `Install ${command}.`} If it is installed, run \`wirebay init\` from a terminal where \`${command}\` works so wirebay remembers its path.`,
    });
  }
}
