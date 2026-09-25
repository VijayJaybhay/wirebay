/**
 * `wirebay sync [servers] [to <tools>] [--global | --project | --dir <path>]`
 * @module
 */

import type { AppContext } from "../app/AppContext.ts";
import type { ParsedCommand } from "../cli/CommandParser.ts";
import { ExitCode, UsageError } from "../core/errors.ts";
import type { ScopeName } from "../core/types.ts";
import { Command } from "./Command.ts";
import { SyncReporter } from "./support/SyncReporter.ts";
import { TargetSelector } from "./support/TargetSelector.ts";

/**
 * Makes tool configs match wirebay's desired state: the global config, plus the current project's
 * `.wirebay.json` when there is one. Naming both servers and tools (`sync github to cursor`) also
 * enables them for those tools, in the scope where the server was added.
 */
export class SyncCommand extends Command {
  readonly name = "sync";
  override readonly aliases = ["push", "apply", "deploy"];
  override readonly targeted = true;
  readonly help = {
    usage: "wirebay sync [servers] [to <tools>|all] [--global | --project | --dir <path>] [--dry-run] [--force]",
    summary: "Make tool configs match wirebay's config (global, plus this project). Only wirebay-managed entries change.",
    examples: [
      "wirebay sync",
      "wirebay sync codex",
      "wirebay sync github to cursor vscode",
      "wirebay sync --project",
      "wirebay sync --dry-run",
    ],
  };

  async run(input: ParsedCommand, ctx: AppContext): Promise<number> {
    const t = ctx.terminal;
    const selector = new TargetSelector(ctx, input);
    const scopes = selector.scopes();
    const named = selector.servers();
    this.assertAdded(named, scopes, ctx);

    const plans: { scope: ScopeName; tools: string[]; servers?: string[] }[] = [];
    for (const scope of scopes) {
      const desired = ctx.desired.servers(scope);
      const servers = named?.filter((s) => desired.has(s));
      if (named && !servers?.length) continue;
      if (servers && Array.isArray(input.tools) && input.tools.length && !input.flags["dry-run"]) {
        ctx.desired.save(scope, desired.enable(servers, input.tools));
      }
      const state = ctx.state.load();
      const tools =
        servers && input.tools === undefined
          ? [...new Set(servers.flatMap((s) => [...desired.toolsOf(s), ...selector.toolsWrittenTo(scope, state, s)]))].sort()
          : selector.toolsForSync(scope, state);
      if (tools.length) plans.push({ scope, tools, servers });
    }

    if (!plans.length) {
      t.out(ctx.desired.allServerNames().length ? "Nothing to sync." : "No servers added yet. Start with: wirebay add github to all");
      return ExitCode.Ok;
    }
    const toolCount = new Set(plans.flatMap((p) => p.tools)).size;
    if (toolCount > 3 && !input.flags["dry-run"] && !input.flags.yes && t.canPrompt(input.flags)) {
      if (!(await t.confirm(`Update ${String(toolCount)} tools?`, input.flags))) return ExitCode.Error;
    }

    let problems = false;
    for (const plan of plans) {
      if (plans.length > 1) t.out(t.bold(`\n${selector.label(plan.scope)}`));
      const outcome = ctx.sync.run({
        ...plan,
        force: !!input.flags.force,
        dryRun: !!input.flags["dry-run"],
        includeMissing: !!input.flags["include-missing"],
      });
      problems = new SyncReporter(t).print(outcome, { dryRun: !!input.flags["dry-run"] }) || problems;
    }
    return problems ? ExitCode.Conflict : ExitCode.Ok;
  }

  private assertAdded(named: string[] | undefined, scopes: ScopeName[], ctx: AppContext): void {
    for (const s of named ?? []) {
      if (!scopes.some((scope) => ctx.desired.servers(scope).has(s))) {
        const where = scopes.length === 1 && scopes[0] === "project" ? " to this project" : "";
        throw new UsageError(`"${s}" hasn't been added${where} yet.`, `Run: wirebay add ${s}${where ? " --project" : ""}`);
      }
    }
  }
}
