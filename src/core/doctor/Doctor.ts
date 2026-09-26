/**
 * `wirebay doctor`: checks that everything will actually work.
 * @module
 */

import { existsSync } from "node:fs";
import type { AppContext } from "../../app/AppContext.ts";
import { McpHandshakeClient } from "../mcp/McpHandshakeClient.ts";
import type { ServerDefinition } from "../servers/ServerDefinition.ts";
import { StateStore } from "../store/StateStore.ts";
import { Reconciler } from "../sync/Reconciler.ts";
import type { ScopeName } from "../types.ts";

/** One check's outcome. */
export interface DoctorCheck {
  /** What the check is about: `wirebay`, a server name or a tool id. */
  area: string;
  name: string;
  status: "ok" | "warn" | "fail";
  detail?: string;
  /** How to fix it (shown when the status isn't ok). */
  fix?: string;
  /** A repair `wirebay doctor --fix` can apply for this finding. */
  repair?: Repair;
}

/** A change `doctor --fix` can make. */
export type Repair =
  /** Take these wirebay-managed servers out of one tool's file (deleting the file if it becomes empty). */
  | { kind: "remove-from-tool"; tool: string; scope: ScopeName; servers: string[] }
  /** Bring these tools' files in line with wirebay's config (e.g. entries written in an older format). */
  | { kind: "sync"; scope: ScopeName; tools: string[] };

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
    const servers = options.servers ?? (options.tools ? [] : this.ctx.desired.allServerNames());
    for (const name of servers) await this.checkServer(name);
    if (!options.servers || options.tools) {
      this.checkToolFiles(options.tools);
      this.checkSharedFiles(options.tools);
      this.checkUpToDate(options.tools);
    }
    return this.checks;
  }

  /**
   * Files another installed tool also reads but can't parse (an incompatible `alsoReads`), e.g.
   * Visual Studio's global `~/.mcp.json`, which Claude Code reads from parent folders. Only the
   * file's existence and wirebay's own records are used; no values are read.
   */
  private checkSharedFiles(onlyTools?: string[]): void {
    const state = this.ctx.state.load();
    for (const tool of this.ctx.tools.all()) {
      if (onlyTools && !onlyTools.includes(tool.id)) continue;
      for (const scope of tool.scopes) {
        if (scope === "project" && !this.ctx.project.exists()) continue;
        const file = tool.configPath(scope, this.ctx.paths, scope === "project" ? this.ctx.project.root : this.ctx.cwd);
        if (!file || !existsSync(file)) continue;
        for (const { reader, read } of this.ctx.readGraph.conflictsFor(tool.id, scope)) {
          if (!reader.isInstalled(this.ctx.resolver, this.ctx.paths)) continue;
          const managed = Object.keys(StateStore.fileRecord(state, tool.id, scope, file)?.entries ?? {});
          this.add({
            area: reader.id,
            name: `${file} is also read by ${reader.name}`,
            status: "warn",
            detail: `it can't parse this ${tool.name} file (${read.note})`,
            fix: managed.length
              ? `wirebay doctor --fix   (or: wirebay disable ${managed.join(" ")} from ${tool.id})`
              : `wirebay didn't write this file. If you don't use ${tool.name}'s ${scope === "user" ? "global" : "project"} MCP config, delete or rename it.`,
            ...(managed.length ? { repair: { kind: "remove-from-tool" as const, tool: tool.id, scope, servers: managed } } : {}),
          });
        }
      }
    }
  }

  /** Tool files whose wirebay entries differ from wirebay's config (e.g. written in an older format). */
  private checkUpToDate(onlyTools?: string[]): void {
    const state = this.ctx.state.load();
    const scopes: ScopeName[] = this.ctx.project.exists() ? ["user", "project"] : ["user"];
    for (const scope of scopes) {
      const tools = StateStore.toolsWithEntries(state, undefined, (f) => f.scope === scope).filter(
        (id) => !onlyTools || onlyTools.includes(id),
      );
      if (!tools.length) continue;
      const outcome = this.ctx.sync.run({ tools, scope, dryRun: true });
      const behind = outcome.results
        .filter((r) => Reconciler.hasChanges(r.plan) && !r.plan.issues.length)
        .map((r) => r.plan.target.tool.id);
      this.add({
        area: "wirebay",
        name: `${scope === "user" ? "global" : "project"} tool files match wirebay's config`,
        status: behind.length ? "warn" : "ok",
        detail: behind.length ? `out of date: ${behind.join(", ")}` : undefined,
        fix: `wirebay sync${scope === "project" ? " --project" : ""}`,
        ...(behind.length ? { repair: { kind: "sync" as const, scope, tools: behind } } : {}),
      });
    }
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
