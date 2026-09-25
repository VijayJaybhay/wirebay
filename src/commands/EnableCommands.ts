/**
 * `wirebay enable`, `wirebay disable` and `wirebay remove`: change which servers go to which
 * tools (globally or for a project), then sync the affected tools.
 * @module
 */

import type { AppContext } from "../app/AppContext.ts";
import type { ParsedCommand } from "../cli/CommandParser.ts";
import { ExitCode, UsageError } from "../core/errors.ts";
import type { ScopeName } from "../core/types.ts";
import { Command } from "./Command.ts";
import { SyncReporter } from "./support/SyncReporter.ts";
import { TargetSelector } from "./support/TargetSelector.ts";

/** Shared behaviour for commands that change the server → tools mapping. */
abstract class MappingCommand extends Command {
  override readonly targeted = true;

  /** Servers named on the command line (`all` = every server added in the scope). */
  protected servers(input: ParsedCommand, ctx: AppContext, scope: ScopeName, verb: string): string[] {
    if (input.servers === "all") return ctx.desired.servers(scope).names();
    if (!input.servers?.length) {
      throw new UsageError(
        `Which server should I ${verb}?`,
        `Example: wirebay ${verb} github ${verb === "enable" ? "for" : "from"} cursor`,
      );
    }
    return input.servers;
  }

  /** Tools named on the command line (`all` = every installed tool that supports the scope). */
  protected tools(input: ParsedCommand, selector: TargetSelector, scope: ScopeName, verb: string): string[] {
    if (input.tools === "all") return selector.allTools(scope);
    if (!input.tools?.length) {
      throw new UsageError("Which tool(s)?", `Example: wirebay ${verb} github ${verb === "enable" ? "for" : "from"} cursor vscode`);
    }
    return input.tools;
  }

  /** Sync the affected tools unless `--no-sync`. */
  protected syncAfter(input: ParsedCommand, ctx: AppContext, scope: ScopeName, tools: string[], servers: string[]): number {
    if (input.flags["no-sync"]) {
      ctx.terminal.out(ctx.terminal.dim("Not synced (--no-sync). Run `wirebay sync` when ready."));
      return ExitCode.Ok;
    }
    const outcome = ctx.sync.run({
      tools,
      servers,
      scope,
      force: !!input.flags.force,
      dryRun: !!input.flags["dry-run"],
      includeMissing: !!input.flags["include-missing"],
    });
    return new SyncReporter(ctx.terminal).print(outcome, { dryRun: !!input.flags["dry-run"] }) ? ExitCode.Conflict : ExitCode.Ok;
  }
}

/** `wirebay enable <servers> for <tools> [--project]` */
export class EnableCommand extends MappingCommand {
  readonly name = "enable";
  override readonly aliases = ["on"];
  readonly help = {
    usage: "wirebay enable <servers> for <tools> [--global | --project | --dir <path>]",
    summary: "Turn servers on for more tools (globally or for this project), then sync.",
    examples: ["wirebay enable netlify for cursor vscode", "wirebay enable github for claude --project"],
  };

  run(input: ParsedCommand, ctx: AppContext): number {
    const selector = new TargetSelector(ctx, input);
    const scope = selector.scope();
    const servers = this.servers(input, ctx, scope, "enable");
    const tools = this.tools(input, selector, scope, "enable");
    for (const s of servers) ctx.servers.get(s);
    if (!input.flags["dry-run"]) ctx.desired.save(scope, ctx.desired.servers(scope).enable(servers, tools));
    const t = ctx.terminal;
    t.out(`${t.ok("✓")} enabled ${servers.join(", ")} for ${tools.join(", ")} ${t.dim(`(${selector.label(scope)})`)}`);
    return this.syncAfter(input, ctx, scope, tools, servers);
  }
}

/** `wirebay disable <servers> from <tools> [--project]` */
export class DisableCommand extends MappingCommand {
  readonly name = "disable";
  override readonly aliases = ["off"];
  readonly help = {
    usage: "wirebay disable <servers> from <tools> [--global | --project | --dir <path>]",
    summary: "Turn servers off for some tools (globally or for this project), then sync.",
    examples: ["wirebay disable aws-api from desktop", "wirebay disable github from cursor --project"],
  };

  run(input: ParsedCommand, ctx: AppContext): number {
    const selector = new TargetSelector(ctx, input);
    const scope = selector.scope();
    const servers = this.servers(input, ctx, scope, "disable");
    const tools = this.tools(input, selector, scope, "disable");
    if (!input.flags["dry-run"]) ctx.desired.save(scope, ctx.desired.servers(scope).disable(servers, tools));
    const t = ctx.terminal;
    t.out(`${t.ok("✓")} disabled ${servers.join(", ")} for ${tools.join(", ")} ${t.dim(`(${selector.label(scope)})`)}`);
    return this.syncAfter(input, ctx, scope, tools, servers);
  }
}

/** `wirebay remove <servers> [from <tools>] [--project]` */
export class RemoveCommand extends MappingCommand {
  readonly name = "remove";
  override readonly aliases = ["rm", "delete", "uninstall"];
  readonly help = {
    usage: "wirebay remove <servers> [from <tools>] [--global | --project | --dir <path>] [--purge]",
    summary: "Remove servers from some tools, or from wirebay and every tool (globally or for this project).",
    examples: ["wirebay remove github from cursor", "wirebay remove github", "wirebay remove github --project"],
  };

  private readonly disable = new DisableCommand();

  async run(input: ParsedCommand, ctx: AppContext): Promise<number> {
    // "remove github from cursor" only takes it out of those tools.
    if (input.tools !== undefined) return this.disable.run(input, ctx);

    const t = ctx.terminal;
    const selector = new TargetSelector(ctx, input);
    const scope = selector.scope();
    const desired = ctx.desired.servers(scope);
    const state = ctx.state.load();
    const servers = this.servers(input, ctx, scope, "remove");
    const tools = [...new Set(servers.flatMap((s) => [...desired.toolsOf(s), ...selector.toolsWrittenTo(scope, state, s)]))].sort();
    const question = `Remove ${servers.join(", ")} from wirebay (${selector.label(scope)})${tools.length ? ` and from ${tools.join(", ")}` : ""}?`;
    if (!input.flags["dry-run"] && !(await t.confirm(question, input.flags))) {
      t.out(t.dim("Cancelled. Pass --yes to skip this question."));
      return ExitCode.Error;
    }
    if (!input.flags["dry-run"]) ctx.desired.save(scope, desired.remove(servers));
    const code = tools.length
      ? this.syncAfter({ ...input, flags: { ...input.flags, "no-sync": false } }, ctx, scope, tools, servers)
      : ExitCode.Ok;
    const presets = ctx.servers.presets();
    for (const s of servers) {
      if (input.flags.purge && !input.flags["dry-run"] && ctx.servers.deleteUserDefinition(s))
        t.out(`${t.ok("✓")} deleted your definition of ${s}`);
      else if (!presets.has(s))
        t.out(t.dim(`  Your definition of ${s} is kept in ~/.wirebay/servers/${s}.json (delete with --purge). Secrets are kept too.`));
    }
    t.out(`${t.ok("✓")} removed ${servers.join(", ")} ${t.dim(`(${selector.label(scope)})`)}`);
    return code;
  }
}
