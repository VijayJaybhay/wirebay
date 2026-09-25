/**
 * `wirebay unsync [tools]`
 * @module
 */

import type { AppContext } from "../app/AppContext.ts";
import type { ParsedCommand } from "../cli/CommandParser.ts";
import { ExitCode } from "../core/errors.ts";
import { StateStore } from "../core/store/StateStore.ts";
import { Command } from "./Command.ts";
import { SyncReporter } from "./support/SyncReporter.ts";
import { TargetSelector } from "./support/TargetSelector.ts";

/** Removes every wirebay-managed entry from tools. wirebay's own config is kept. */
export class UnsyncCommand extends Command {
  readonly name = "unsync";
  override readonly aliases = ["detach"];
  override readonly targeted = true;
  readonly help = {
    usage: "wirebay unsync [tools]",
    summary: "Remove every wirebay-managed entry from tools (config is kept).",
    examples: ["wirebay unsync all", "wirebay unsync codex"],
  };

  async run(input: ParsedCommand, ctx: AppContext): Promise<number> {
    const t = ctx.terminal;
    const config = ctx.config.load();
    const state = ctx.state.load();
    const tools = Array.isArray(input.tools) && input.tools.length ? input.tools : StateStore.toolsWithEntries(state);
    if (!tools.length) {
      t.out("Nothing to unsync: wirebay has not written to any tool yet.");
      return ExitCode.Ok;
    }
    const selector = new TargetSelector(ctx, input);
    const servers = selector.servers();
    const what = servers ? servers.join(", ") : "all wirebay-managed servers";
    if (!input.flags["dry-run"] && !(await t.confirm(`Remove ${what} from ${tools.join(", ")}? (wirebay config is kept)`, input.flags))) {
      t.out(t.dim("Cancelled. Pass --yes to skip this question."));
      return ExitCode.Error;
    }
    const outcome = ctx.sync.run({ tools, servers, scope: selector.scope(config), force: !!input.flags.force, dryRun: !!input.flags["dry-run"], removeOnly: true });
    const problems = new SyncReporter(t).print(outcome, { dryRun: !!input.flags["dry-run"] });
    if (!input.flags["dry-run"]) t.out(t.dim("Run `wirebay sync` to put them back."));
    return problems ? ExitCode.Conflict : ExitCode.Ok;
  }
}
