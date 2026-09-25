// `wirebay enable <servers> for <tools>` / `wirebay disable <servers> from <tools>`
// `wirebay remove <servers> [from <tools>]`
// These change the desired state in ~/.wirebay/config.json, then sync the affected tools.

import type { ParsedCommand } from "../cli/parse.ts";
import { c, confirm, out } from "../cli/ui.ts";
import { EXIT, UsageError } from "../core/errors.ts";
import { deleteUserServer, loadPresets } from "../core/servers.ts";
import { loadConfig, loadState, saveConfig } from "../core/store.ts";
import { runSync } from "../core/sync.ts";
import { allTools, printOutcome, scopeOf, toolsInState } from "./context.ts";

function namedServers(cmd: ParsedCommand, verb: string): string[] {
  const config = loadConfig();
  if (cmd.servers === "all") return Object.keys(config.servers);
  if (!cmd.servers?.length) throw new UsageError(`Which server should I ${verb}?`, `Example: wirebay ${verb} github ${verb === "enable" ? "for" : "from"} cursor`);
  return cmd.servers;
}

function namedTools(cmd: ParsedCommand, verb: string): string[] {
  const config = loadConfig();
  if (cmd.tools === "all") return allTools(cmd, config);
  if (!cmd.tools?.length) throw new UsageError(`Which tool(s)?`, `Example: wirebay ${verb} github ${verb === "enable" ? "for" : "from"} cursor vscode`);
  return cmd.tools;
}

function finish(cmd: ParsedCommand, tools: string[], servers: string[]): number {
  if (cmd.flags["no-sync"]) {
    out(c.dim("Not synced (--no-sync). Run `wirebay sync` when ready."));
    return 0;
  }
  const config = loadConfig();
  const outcome = runSync({
    tools,
    servers,
    scope: scopeOf(cmd, config),
    force: !!cmd.flags.force,
    dryRun: !!cmd.flags["dry-run"],
    includeMissing: !!cmd.flags["include-missing"],
  });
  return printOutcome(outcome, { dryRun: !!cmd.flags["dry-run"] }) ? EXIT.conflict : 0;
}

export async function enable(cmd: ParsedCommand): Promise<number> {
  const servers = namedServers(cmd, "enable");
  const tools = namedTools(cmd, "enable");
  const config = loadConfig();
  for (const s of servers) {
    if (!config.servers[s]) throw new UsageError(`"${s}" hasn't been added yet.`, `Run: wirebay add ${s} to ${tools.join(" ")}`);
    config.servers[s] = { tools: [...new Set([...config.servers[s]!.tools, ...tools])].sort() };
  }
  if (!cmd.flags["dry-run"]) saveConfig(config);
  out(`${c.ok("✓")} enabled ${servers.join(", ")} for ${tools.join(", ")}`);
  return finish(cmd, tools, servers);
}

export async function disable(cmd: ParsedCommand): Promise<number> {
  const servers = namedServers(cmd, "disable");
  const tools = namedTools(cmd, "disable");
  const config = loadConfig();
  for (const s of servers) {
    if (!config.servers[s]) continue;
    config.servers[s] = { tools: config.servers[s]!.tools.filter((t) => !tools.includes(t)) };
  }
  if (!cmd.flags["dry-run"]) saveConfig(config);
  out(`${c.ok("✓")} disabled ${servers.join(", ")} for ${tools.join(", ")}`);
  return finish(cmd, tools, servers);
}

export async function remove(cmd: ParsedCommand): Promise<number> {
  // "remove github from cursor" only takes it out of those tools.
  if (cmd.tools !== undefined) return disable(cmd);

  const config = loadConfig();
  const state = loadState();
  const servers = namedServers(cmd, "remove");
  const tools = [...new Set(servers.flatMap((s) => [...(config.servers[s]?.tools ?? []), ...toolsInState(state, s)]))].sort();
  if (!cmd.flags["dry-run"] && !(await confirm(`Remove ${servers.join(", ")} from wirebay${tools.length ? ` and from ${tools.join(", ")}` : ""}?`, cmd.flags))) {
    out(c.dim("Cancelled. Pass --yes to skip this question."));
    return 1;
  }
  for (const s of servers) delete config.servers[s];
  if (!cmd.flags["dry-run"]) saveConfig(config);
  const code = tools.length ? finish({ ...cmd, flags: { ...cmd.flags, "no-sync": false } }, tools, servers) : 0;
  const presets = loadPresets();
  for (const s of servers) {
    if (cmd.flags.purge && !cmd.flags["dry-run"] && deleteUserServer(s)) out(`${c.ok("✓")} deleted your definition of ${s}`);
    else if (!presets.has(s)) out(c.dim(`  Your definition of ${s} is kept in ~/.wirebay/servers/${s}.json (delete with --purge). Secrets are kept too.`));
  }
  out(`${c.ok("✓")} removed ${servers.join(", ")}`);
  return code;
}
