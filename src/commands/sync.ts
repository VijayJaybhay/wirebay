// `wirebay sync [servers] [to tools]`: make tool configs match ~/.wirebay/config.json.
// Naming both servers and tools (`sync github to cursor`) also enables them for those tools.
// `wirebay unsync [tools]`: remove every wirebay-managed entry (config is kept).

import type { ParsedCommand } from "../cli/parse.ts";
import { c, confirm, out } from "../cli/ui.ts";
import { EXIT, UsageError } from "../core/errors.ts";
import { loadConfig, loadState, saveConfig } from "../core/store.ts";
import { runSync } from "../core/sync.ts";
import { allTools, printOutcome, scopeOf, serverList, toolsForSync, toolsInState } from "./context.ts";

export async function sync(cmd: ParsedCommand): Promise<number> {
  const config = loadConfig();
  const state = loadState();
  const servers = serverList(cmd.servers, config);
  for (const s of servers ?? []) {
    if (!config.servers[s]) throw new UsageError(`"${s}" hasn't been added yet.`, `Run: wirebay add ${s}`);
  }
  let tools = cmd.tools === "all" ? allTools(cmd, config) : toolsForSync(cmd.tools, config, state);

  // "sync github to cursor" means "I want github in cursor".
  if (servers && Array.isArray(cmd.tools) && cmd.tools.length && !cmd.flags["dry-run"]) {
    for (const s of servers) config.servers[s] = { tools: [...new Set([...config.servers[s]!.tools, ...cmd.tools])].sort() };
    saveConfig(config);
  }
  if (servers && cmd.tools === undefined) {
    tools = [...new Set(servers.flatMap((s) => [...config.servers[s]!.tools, ...toolsInState(state, s)]))].sort();
  }
  if (!tools.length) {
    out(Object.keys(config.servers).length ? "Nothing to sync." : "No servers added yet. Start with: wirebay add github to all");
    return 0;
  }
  if (tools.length > 3 && !cmd.flags["dry-run"] && !cmd.flags.yes && process.stdin.isTTY && !process.env.CI) {
    if (!(await confirm(`Update ${tools.length} tools (${tools.join(", ")})?`, cmd.flags))) return 1;
  }
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

export async function unsync(cmd: ParsedCommand): Promise<number> {
  const config = loadConfig();
  const state = loadState();
  const tools = Array.isArray(cmd.tools) && cmd.tools.length ? cmd.tools : toolsInState(state);
  if (!tools.length) {
    out("Nothing to unsync: wirebay has not written to any tool yet.");
    return 0;
  }
  const servers = serverList(cmd.servers, config);
  const what = servers ? servers.join(", ") : "all wirebay-managed servers";
  if (!cmd.flags["dry-run"] && !(await confirm(`Remove ${what} from ${tools.join(", ")}? (wirebay config is kept)`, cmd.flags))) {
    out(c.dim("Cancelled. Pass --yes to skip this question."));
    return 1;
  }
  const outcome = runSync({ tools, servers, scope: scopeOf(cmd, config), force: !!cmd.flags.force, dryRun: !!cmd.flags["dry-run"], removeOnly: true });
  const problems = printOutcome(outcome, { dryRun: !!cmd.flags["dry-run"] });
  if (!cmd.flags["dry-run"]) out(c.dim("Run `wirebay sync` to put them back."));
  return problems ? EXIT.conflict : 0;
}
