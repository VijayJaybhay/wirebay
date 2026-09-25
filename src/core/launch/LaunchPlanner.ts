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
  private readonly processes: ProcessCommand;
  private readonly templates = new TemplateExpander();

  /**
   * @param resolver - Finds `npx`, `uvx`, `docker`, …
   * @param processes - Builds spawnable commands (handles Windows `.cmd` shims).
   */
  constructor(resolver: ExecutableResolver, processes: ProcessCommand = new ProcessCommand()) {
    this.resolver = resolver;
    this.processes = processes;
  }

  /**
   * Plan how to start a server.
   * @param server - The server definition.
   * @param secretValues - All values from the secrets store.
   * @param baseEnv - The environment the tool started us with (PATH, HOME, …).
   * @throws {@link core/errors!WirebayError} when a required secret or the executable is missing.
   */
  plan(server: ServerDefinition, secretValues: Record<string, string>, baseEnv: NodeJS.ProcessEnv): LaunchPlan {
    const provided = this.declaredSecrets(server, secretValues);
    const env = this.environment(server, provided, baseEnv);

    const missing = server.requiredKeys().filter((k) => !env.has(k));
    if (missing.length) {
      throw new WirebayError(`Server "${server.name}" is missing required secret(s): ${missing.join(", ")}.`, {
        hint: missing.map((k) => `wirebay secrets set ${k}`).join("\n"),
      });
    }

    const redact = [...provided.values()].filter((v) => v.length >= 4);
    const vars = Object.fromEntries(env);
    const launch = server.launch;
    if (launch.type === "stdio") {
      const exe = this.require(launch.command, server.name);
      return { server: server.name, ...this.processes.forExecutable(exe, this.templates.expandArgs(launch.args, vars)), env: vars, redact };
    }

    // Remote: bridge through mcp-remote; the token travels in the environment, not argv.
    const args = ["-y", LaunchPlanner.mcpRemotePackage, this.templates.expand(launch.url, vars)];
    for (const [name, raw] of Object.entries(launch.headers ?? {})) {
      const value = this.templates.expand(raw, vars);
      if (value) args.push("--header", `${name}:${value}`);
    }
    const auth = launch.auth;
    if (auth && (auth.type === "bearer" || auth.type === "header")) {
      const token = env.get(auth.secret);
      if (token === undefined)
        throw new WirebayError(`Server "${server.name}" needs ${auth.secret}.`, { hint: `wirebay secrets set ${auth.secret}` });
      const header = auth.type === "bearer" ? "Authorization" : auth.header;
      const value = `${auth.type === "bearer" ? "Bearer " : (auth.prefix ?? "")}${token}`;
      vars[LaunchPlanner.authEnv] = value;
      redact.push(value);
      args.push("--header", `${header}:\${${LaunchPlanner.authEnv}}`);
    }
    const npx = this.require("npx", server.name);
    return { server: server.name, ...this.processes.forExecutable(npx, args), env: vars, redact };
  }

  /** Values from the secrets store for the keys this server declares (and nothing else). */
  private declaredSecrets(server: ServerDefinition, secretValues: Record<string, string>): Map<string, string> {
    const provided = new Map<string, string>();
    for (const key of server.declaredKeys()) {
      const value = secretValues[key];
      if (value) provided.set(key, value);
    }
    return provided;
  }

  /**
   * The child environment: the parent environment, plus declared secrets, plus the server's
   * default env values (which the secrets store may override). Empty values are left out.
   */
  private environment(server: ServerDefinition, provided: Map<string, string>, baseEnv: NodeJS.ProcessEnv): Map<string, string> {
    const env = new Map<string, string>();
    for (const [k, v] of Object.entries(baseEnv)) if (v !== undefined) env.set(k, v);
    for (const [k, v] of provided) env.set(k, v);
    for (const [k, raw] of Object.entries(server.env)) {
      if (provided.has(k)) continue;
      const value = this.templates.expand(raw, Object.fromEntries(env));
      if (value === "") env.delete(k);
      else env.set(k, value);
    }
    return env;
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
