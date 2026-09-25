/**
 * `wirebay doctor`: checks that everything will actually work.
 * @module
 */

import { existsSync } from "node:fs";
import type { AppContext } from "../../app/AppContext.ts";
import { McpHandshakeClient } from "../mcp/McpHandshakeClient.ts";
import type { ServerDefinition } from "../servers/ServerDefinition.ts";

/** One check's outcome. */
export interface DoctorCheck {
  /** What the check is about: `wirebay`, a server name or a tool id. */
  area: string;
  name: string;
  status: "ok" | "warn" | "fail";
  detail?: string;
  /** How to fix it (shown when the status isn't ok). */
  fix?: string;
}

/** What to check. */
export interface DoctorOptions {
  /** Servers to check (default: every added server). */
  servers?: string[];
  /** Only check these tools' files. */
  tools?: string[];
  /** Skip starting servers. */
  offline?: boolean;
  /** Seconds to wait for each handshake. */
  timeoutSeconds?: number;
  /** Called for each check as it completes (for streaming output). */
  onCheck?: (check: DoctorCheck) => void;
  /** Called before a server is started (it may take a while). */
  onStart?: (server: string) => void;
}

/**
 * Runs the checks:
 * - Node version, wirebay home, secrets file permissions
 * - per server: prerequisites found, required secrets set, a real MCP handshake
 * - per synced tool file: the launcher paths inside still exist (they break after a Node upgrade)
 */
export class Doctor {
  private readonly ctx: AppContext;
  private readonly checks: DoctorCheck[] = [];
  private options: DoctorOptions = {};

  constructor(ctx: AppContext) {
    this.ctx = ctx;
  }

  /** Run every check and return them all. */
  async run(options: DoctorOptions = {}): Promise<DoctorCheck[]> {
    this.options = options;
    this.checkEnvironment();
    const config = this.ctx.config.load();
    const servers = options.servers ?? (options.tools ? [] : Object.keys(config.servers));
    for (const name of servers) await this.checkServer(name);
    if (!options.servers || options.tools) this.checkToolFiles(options.tools);
    return this.checks;
  }

  private add(check: DoctorCheck): void {
    this.checks.push(check);
    this.options.onCheck?.(check);
  }

  private checkEnvironment(): void {
    const paths = this.ctx.paths;
    const major = Number(process.versions.node.split(".")[0]);
    this.add({
      area: "wirebay",
      name: `Node.js ${process.versions.node}`,
      status: major >= 24 ? "ok" : "fail",
      fix: "Install Node.js 24 or newer.",
    });
    const initialised = existsSync(paths.configFile);
    this.add({
      area: "wirebay",
      name: `home ${paths.home}`,
      status: initialised ? "ok" : "warn",
      detail: initialised ? undefined : "not initialised",
      fix: "wirebay init",
    });
    const perm = this.ctx.permissions.check(paths.secretsFile);
    const hasSecrets = existsSync(paths.secretsFile);
    this.add({
      area: "wirebay",
      name: "secrets file is private",
      status: hasSecrets ? (perm ? "fail" : "ok") : "warn",
      detail: perm,
      fix: perm ?? "wirebay init",
    });
  }

  private async checkServer(name: string): Promise<void> {
    if (!this.ctx.servers.has(name)) {
      this.add({ area: name, name: "definition", status: "fail", detail: "unknown server", fix: `wirebay remove ${name}` });
      return;
    }
    const def = this.ctx.servers.get(name);
    const secretValues = this.ctx.secrets.all();
    const launch = def.launch;
    const exe = launch.type === "stdio" ? launch.command : "npx";
    const found = this.ctx.resolver.resolve(exe);
    this.add({
      area: name,
      name: `${exe} available`,
      status: found ? "ok" : "fail",
      detail: found,
      fix: `Install ${exe}, then run \`wirebay init\` from a terminal where it works.`,
    });

    const missing = def.requiredKeys().filter((k) => !secretValues[k] && !this.ctx.env[k]);
    this.add({
      area: name,
      name: "required secrets set",
      status: missing.length ? "fail" : "ok",
      detail: missing.length ? `missing ${missing.join(", ")}` : undefined,
      fix: missing.map((k) => `wirebay secrets set ${k}`).join("\n"),
    });
    for (const spec of def.secrets) {
      const v = secretValues[spec.key];
      if (v && spec.pattern && !new RegExp(spec.pattern).test(v)) {
        this.add({
          area: name,
          name: `${spec.key} format`,
          status: "warn",
          detail: `does not match ${spec.pattern}`,
          fix: `wirebay secrets set ${spec.key}`,
        });
      }
    }
    if (this.options.offline || missing.length || !found) return;
    await this.handshake(def, secretValues);
  }

  private async handshake(def: ServerDefinition, secretValues: Record<string, string>): Promise<void> {
    try {
      const plan = this.ctx.planner.plan(def, secretValues, this.ctx.env);
      this.options.onStart?.(def.name);
      const r = await new McpHandshakeClient((this.options.timeoutSeconds ?? 90) * 1000).run(plan);
      const guide = def.guide ?? def.docs ?? "";
      if (!r.ok && /\b401\b|unauthori[sz]ed|dynamic client registration|invalid.*token|bad credentials/i.test(r.stderrTail ?? "")) {
        this.add({
          area: def.name,
          name: "MCP handshake",
          status: "fail",
          detail: "the server rejected the credentials (HTTP 401)",
          fix: `Check or replace the token: ${
            def
              .requiredKeys()
              .map((k) => `wirebay secrets set ${k}`)
              .join(" · ") || "see the guide"
          }\nGuide: ${guide}`,
        });
        return;
      }
      this.add({
        area: def.name,
        name: "MCP handshake",
        status: r.ok ? (r.stdoutNoise.length ? "warn" : "ok") : "fail",
        detail: r.ok
          ? `${r.serverInfo?.name ?? "server"} ${r.serverInfo?.version ?? ""} · ${r.toolCount === undefined ? "?" : String(r.toolCount)} tools · ${(r.ms / 1000).toFixed(1)}s${r.stdoutNoise[0] ? ` · prints non-MCP output: ${r.stdoutNoise[0]}` : ""}`
          : r.error,
        fix: r.ok ? undefined : `${r.stderrTail ? `server said:\n${r.stderrTail}\n` : ""}Check the token and the guide: ${guide}`,
      });
    } catch (err) {
      this.add({ area: def.name, name: "MCP handshake", status: "fail", detail: (err as Error).message });
    }
  }

  private checkToolFiles(onlyTools?: string[]): void {
    const state = this.ctx.state.load();
    const known = new Set(this.ctx.tools.aliasMap().keys());
    for (const f of Object.values(state.files)) {
      if (onlyTools && !onlyTools.includes(f.tool)) continue;
      if (!known.has(f.tool)) continue;
      const tool = this.ctx.tools.get(f.tool);
      let entries: Record<string, Record<string, unknown>>;
      try {
        entries = this.ctx.adapters.for(tool).read({ tool, scope: f.scope, file: f.path }).entries;
      } catch (err) {
        this.add({
          area: tool.id,
          name: `read ${f.path}`,
          status: "fail",
          detail: (err as Error).message,
          fix: `wirebay restore ${tool.id}`,
        });
        continue;
      }
      const broken = Object.keys(f.entries).filter((name) => {
        const e = entries[name];
        if (!e) return false;
        const candidates = [e.command as string | undefined, ((e.args as string[] | undefined) ?? [])[0]];
        return candidates.some((p) => !!p && /[\\/]/.test(p) && !existsSync(p));
      });
      const removed = Object.keys(f.entries).filter((n) => !entries[n]);
      this.add({
        area: tool.id,
        name: f.path,
        status: broken.length || removed.length ? "warn" : "ok",
        detail: broken.length
          ? `launcher path no longer exists for ${broken.join(", ")} (Node or wirebay moved)`
          : removed.length
            ? `removed outside wirebay: ${removed.join(", ")}`
            : `${String(Object.keys(f.entries).length)} managed server(s)`,
        fix: `wirebay sync to ${tool.id} --force`,
      });
    }
  }
}
