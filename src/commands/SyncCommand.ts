/**
 * `wirebay sync [servers] [to <tools>]`
 * @module
 */

import type { AppContext } from "../app/AppContext.ts";
import type { ParsedCommand } from "../cli/CommandParser.ts";
import { ExitCode, UsageError } from "../core/errors.ts";
import { ConfigStore } from "../core/store/ConfigStore.ts";
import { StateStore } from "../core/store/StateStore.ts";
import { Command } from "./Command.ts";
import { SyncReporter } from "./support/SyncReporter.ts";
import { TargetSelector } from "./support/TargetSelector.ts";

/**
 * Makes tool configs match wirebay's config. Naming both servers and tools
 * (`sync github to cursor`) also enables them for those tools.
 */
export class SyncCommand extends Command {
  readonly name = "sync";
  override readonly aliases = ["push", "apply", "deploy"];
  override readonly targeted = true;
  readonly help = {
    usage: "wirebay sync [servers] [to <tools>|all] [--dry-run] [--force] [--scope project]",
    summary: "Make tool configs match wirebay's config. Adds, updates and removes only wirebay-managed entries.",
    examples: ["wirebay sync", "wirebay sync codex", "wirebay sync github to cursor vscode", "wirebay sync --dry-run"],
  };

  async run(input: ParsedCommand, ctx: AppContext): Promise<number> {
    const t = ctx.terminal;
    const config = ctx.config.load();
    const state = ctx.state.load();
    const selector = new TargetSelector(ctx, input);
    const servers = selector.servers();
    for (const s of servers ?? []) if (!config.servers[s]) throw new UsageError(`"${s}" hasn't been added yet.`, `Run: wirebay add ${s}`);

    let tools = selector.toolsForSync(config, state);
    if (servers && Array.isArray(input.tools) && input.tools.length && !input.flags["dry-run"]) {
      ConfigStore.enable(config, servers, input.tools);
      ctx.config.save(config);
    }
    if (servers && input.tools === undefined) {
      tools = [...new Set(servers.flatMap((s) => [...config.servers[s]!.tools, ...StateStore.toolsWithEntries(state, s)]))].sort();
    }
    if (!tools.length) {
      t.out(Object.keys(config.servers).length ? "Nothing to sync." : "No servers added yet. Start with: wirebay add github to all");
      return ExitCode.Ok;
    }
    if (tools.length > 3 && !input.flags["dry-run"] && !input.flags.yes && t.canPrompt(input.flags)) {
      if (!(await t.confirm(`Update ${tools.length} tools (${tools.join(", ")})?`, input.flags))) return ExitCode.Error;
    }
    const outcome = ctx.sync.run({
      tools,
      servers,
      scope: selector.scope(config),
      force: !!input.flags.force,
      dryRun: !!input.flags["dry-run"],
      includeMissing: !!input.flags["include-missing"],
    });
    return new SyncReporter(t).print(outcome, { dryRun: !!input.flags["dry-run"] }) ? ExitCode.Conflict : ExitCode.Ok;
  }
}
