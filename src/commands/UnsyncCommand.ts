/**
 * `wirebay unsync [tools] [--global | --project | --dir <path>]`
 * @module
 */

import type { AppContext } from "../app/AppContext.ts";
import type { ParsedCommand } from "../cli/CommandParser.ts";
import { ExitCode } from "../core/errors.ts";
import { Command } from "./Command.ts";
import { SyncReporter } from "./support/SyncReporter.ts";
import { TargetSelector } from "./support/TargetSelector.ts";

/** Removes every wirebay-managed entry from tools. wirebay's own config is kept. */
export class UnsyncCommand extends Command {
  readonly name = "unsync";
  override readonly aliases = ["detach"];
  override readonly targeted = true;
  readonly help = {
    usage: "wirebay unsync [tools] [--global | --project | --dir <path>]",
    summary: "Remove every wirebay-managed entry from tools (config is kept).",
    examples: ["wirebay unsync all", "wirebay unsync codex", "wirebay unsync --project"],
  };

  async run(input: ParsedCommand, ctx: AppContext): Promise<number> {
    const t = ctx.terminal;
    const selector = new TargetSelector(ctx, input);
    const state = ctx.state.load();
    const named = Array.isArray(input.tools) && input.tools.length ? input.tools : undefined;
    const plans = selector
      .scopes()
      .map((scope) => ({ scope, tools: named ?? selector.toolsWrittenTo(scope, state) }))
      .filter((p) => p.tools.length);
    if (!plans.length) {
      t.out("Nothing to unsync: wirebay has not written to any tool here yet.");
      return ExitCode.Ok;
    }
    const servers = selector.servers();
    const what = servers ? servers.join(", ") : "all wirebay-managed servers";
    const where = plans.map((p) => `${p.tools.join(", ")} (${selector.label(p.scope)})`).join("; ");
    if (!input.flags["dry-run"] && !(await t.confirm(`Remove ${what} from ${where}? (wirebay config is kept)`, input.flags))) {
      t.out(t.dim("Cancelled. Pass --yes to skip this question."));
      return ExitCode.Error;
    }
    let problems = false;
    for (const plan of plans) {
      if (plans.length > 1) t.out(t.bold(`\n${selector.label(plan.scope)}`));
      const hadProblems = new SyncReporter(t).run(ctx.sync, {
        ...plan,
        servers,
        force: !!input.flags.force,
        dryRun: !!input.flags["dry-run"],
        removeOnly: true,
      });
      problems = hadProblems || problems;
    }
    if (!input.flags["dry-run"]) t.out(t.dim("Run `wirebay sync` to put them back."));
    return problems ? ExitCode.Conflict : ExitCode.Ok;
  }
}
