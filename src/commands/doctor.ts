// `wirebay doctor [server|tool]`: checks that everything will actually work.
//   - Node version, wirebay home, secrets file permissions
//   - per server: prerequisites found, required secrets set, real MCP handshake (skip with --offline)
//   - per synced tool file: the node/cli paths inside still exist (they break after a Node upgrade)

import { existsSync } from "node:fs";
import type { ParsedCommand } from "../cli/parse.ts";
import { c, out, printJson } from "../cli/ui.ts";
import { adapterFor } from "../adapters/index.ts";
import { EXIT } from "../core/errors.ts";
import { buildLaunchPlan } from "../core/launcher.ts";
import { homePaths, resolveExecutable, wirebayHome } from "../core/paths.ts";
import { checkPermissions, secrets } from "../core/secrets.ts";
import { effectiveLaunch, loadServers, requiredKeys } from "../core/servers.ts";
import { loadConfig, loadState } from "../core/store.ts";
import { getTool, loadTools } from "../core/tools.ts";
import { handshake } from "../mcp/handshake.ts";

interface Check {
  area: string;
  name: string;
  status: "ok" | "warn" | "fail";
  detail?: string;
  fix?: string;
}

export async function doctor(cmd: ParsedCommand): Promise<number> {
  const checks: Check[] = [];
  const add = (ch: Check) => {
    checks.push(ch);
    if (!cmd.flags.json) {
      const icon = ch.status === "ok" ? c.ok("✓") : ch.status === "warn" ? c.warn("!") : c.err("✗");
      out(`${icon} ${c.dim(ch.area + ":")} ${ch.name}${ch.detail ? c.dim(`  ${ch.detail}`) : ""}`);
      if (ch.fix && ch.status !== "ok") out(`    ${c.cyan("fix:")} ${ch.fix.replace(/\n/g, "\n         ")}`);
    }
  };

  // Environment
  const major = Number(process.versions.node.split(".")[0]);
  add({ area: "wirebay", name: `Node.js ${process.versions.node}`, status: major >= 24 ? "ok" : "fail", fix: "Install Node.js 24 or newer." });
  add({
    area: "wirebay",
    name: `home ${wirebayHome()}`,
    status: existsSync(homePaths.config()) ? "ok" : "warn",
    fix: "wirebay init",
    detail: existsSync(homePaths.config()) ? undefined : "not initialised",
  });
  const perm = checkPermissions();
  add({ area: "wirebay", name: "secrets file is private", status: existsSync(homePaths.secrets()) ? (perm ? "fail" : "ok") : "warn", detail: perm, fix: perm ?? "wirebay init" });

  const config = loadConfig();
  const servers = loadServers();
  const secretValues = secrets().all();
  const tools = loadTools();
  const toolIds = new Set(tools.flatMap((t) => [t.id, ...(t.aliases ?? [])]));

  const wanted = Array.isArray(cmd.servers) ? cmd.servers : cmd.tools ? [] : Object.keys(config.servers);
  // Servers
  for (const name of wanted) {
    const def = servers.get(name);
    if (!def) {
      add({ area: name, name: "definition", status: "fail", detail: "unknown server", fix: `wirebay remove ${name}` });
      continue;
    }
    const launch = effectiveLaunch(def);
    const exe = launch.type === "stdio" ? launch.command : "npx";
    const found = resolveExecutable(exe, config.paths);
    add({ area: name, name: `${exe} available`, status: found ? "ok" : "fail", detail: found, fix: `Install ${exe}, then run \`wirebay init\` from a terminal where it works.` });
    const missing = requiredKeys(def).filter((k) => !secretValues[k] && !process.env[k]);
    add({
      area: name,
      name: "required secrets set",
      status: missing.length ? "fail" : "ok",
      detail: missing.length ? `missing ${missing.join(", ")}` : undefined,
      fix: missing.map((k) => `wirebay secrets set ${k}`).join("\n"),
    });
    for (const spec of def.secrets ?? []) {
      const v = secretValues[spec.key];
      if (v && spec.pattern && !new RegExp(spec.pattern).test(v)) {
        add({ area: name, name: `${spec.key} format`, status: "warn", detail: `does not match ${spec.pattern}`, fix: `wirebay secrets set ${spec.key}` });
      }
    }
    if (cmd.flags.offline || missing.length || !found) continue;
    try {
      const plan = buildLaunchPlan(def, secretValues, process.env, config.paths);
      if (!cmd.flags.json) out(c.dim(`    starting ${name} (first run may download packages)…`));
      const timeout = Number(cmd.flags.timeout ?? 90) * 1000;
      const r = await handshake(plan, timeout);
      const authRejected = !r.ok && /\b401\b|unauthori[sz]ed|dynamic client registration|invalid.*token|bad credentials/i.test(r.stderrTail ?? "");
      if (authRejected) {
        add({
          area: name,
          name: "MCP handshake",
          status: "fail",
          detail: "the server rejected the credentials (HTTP 401)",
          fix: `Check or replace the token: ${requiredKeys(def).map((k) => `wirebay secrets set ${k}`).join(" · ") || "see the guide"}\nGuide: ${def.guide ?? def.docs ?? ""}`,
        });
        continue;
      }
      add({
        area: name,
        name: "MCP handshake",
        status: r.ok ? (r.stdoutNoise.length ? "warn" : "ok") : "fail",
        detail: r.ok
          ? `${r.serverInfo?.name ?? "server"} ${r.serverInfo?.version ?? ""} · ${r.toolCount ?? "?"} tools · ${(r.ms / 1000).toFixed(1)}s${r.stdoutNoise.length ? ` · prints non-MCP output: ${r.stdoutNoise[0]}` : ""}`
          : r.error,
        fix: r.ok ? undefined : `${r.stderrTail ? `server said:\n${r.stderrTail}\n` : ""}Check the token and the guide: ${def.guide ?? def.docs ?? ""}`,
      });
    } catch (err) {
      add({ area: name, name: "MCP handshake", status: "fail", detail: (err as Error).message });
    }
  }

  // Tool files: stale launcher paths
  const state = loadState();
  const onlyTools = Array.isArray(cmd.tools) ? new Set(cmd.tools) : undefined;
  for (const f of Object.values(state.files)) {
    if (onlyTools && !onlyTools.has(f.tool)) continue;
    if (Array.isArray(cmd.servers) && !onlyTools) continue;
    if (!toolIds.has(f.tool)) continue;
    const tool = getTool(f.tool, tools);
    let entries: Record<string, Record<string, unknown>> = {};
    try {
      entries = adapterFor(tool).read({ tool, scope: f.scope, file: f.path }).entries;
    } catch (err) {
      add({ area: tool.id, name: `read ${f.path}`, status: "fail", detail: (err as Error).message, fix: `wirebay restore ${tool.id}` });
      continue;
    }
    const broken: string[] = [];
    for (const name of Object.keys(f.entries)) {
      const e = entries[name];
      if (!e) continue;
      const command = e.command as string | undefined;
      const args = (e.args as string[] | undefined) ?? [];
      const paths = [command, args[0]].filter((p): p is string => !!p && /[\\/]/.test(p));
      if (paths.some((p) => !existsSync(p))) broken.push(name);
    }
    const missingEntries = Object.keys(f.entries).filter((n) => !entries[n]);
    add({
      area: tool.id,
      name: `${f.path}`,
      status: broken.length || missingEntries.length ? "warn" : "ok",
      detail: broken.length
        ? `launcher path no longer exists for ${broken.join(", ")} (Node or wirebay moved)`
        : missingEntries.length
          ? `removed outside wirebay: ${missingEntries.join(", ")}`
          : `${Object.keys(f.entries).length} managed server(s)`,
      fix: `wirebay sync to ${tool.id} --force`,
    });
  }

  const fails = checks.filter((ch) => ch.status === "fail").length;
  const warns = checks.filter((ch) => ch.status === "warn").length;
  if (cmd.flags.json) printJson({ ok: fails === 0, fails, warnings: warns, checks });
  else out(fails ? c.err(`\n${fails} problem(s), ${warns} warning(s).`) : c.ok(`\nAll good${warns ? ` (${warns} warning(s))` : ""}.`));
  return fails ? EXIT.doctorProblems : 0;
}
