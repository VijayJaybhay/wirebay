/**
 * `wirebay enable`, `wirebay disable` and `wirebay remove`: change which servers go to which
 * tools, then sync the affected tools.
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

/** Shared behaviour for commands that change the server → tools mapping. */
abstract class MappingCommand extends Command {
  override readonly targeted = true;

  /** Servers named on the command line (`all` = every added server). */
  protected servers(input: ParsedCommand, ctx: AppContext, verb: string): string[] {
    if (input.servers === "all") return Object.keys(ctx.config.load().servers);
    if (!input.servers?.length)
      throw new UsageError(
        `Which server should I ${verb}?`,
        `Example: wirebay ${verb} github ${verb === "enable" ? "for" : "from"} cursor`,
      );
    return input.servers;
  }

  /** Tools named on the command line (`all` = every installed tool). */
  protected tools(input: ParsedCommand, ctx: AppContext, verb: string): string[] {
    if (input.tools === "all") return new TargetSelector(ctx, input).allTools();
    if (!input.tools?.length)
      throw new UsageError("Which tool(s)?", `Example: wirebay ${verb} github ${verb === "enable" ? "for" : "from"} cursor vscode`);
    return input.tools;
  }

  /** Sync the affected tools unless `--no-sync`. */
  protected syncAfter(input: ParsedCommand, ctx: AppContext, tools: string[], servers: string[]): number {
    if (input.flags["no-sync"]) {
      ctx.terminal.out(ctx.terminal.dim("Not synced (--no-sync). Run `wirebay sync` when ready."));
      return ExitCode.Ok;
    }
    const outcome = ctx.sync.run({
      tools,
      servers,
      scope: new TargetSelector(ctx, input).scope(ctx.config.load()),
      force: !!input.flags.force,
      dryRun: !!input.flags["dry-run"],
      includeMissing: !!input.flags["include-missing"],
    });
    return new SyncReporter(ctx.terminal).print(outcome, { dryRun: !!input.flags["dry-run"] }) ? ExitCode.Conflict : ExitCode.Ok;
  }
}

/** `wirebay enable <servers> for <tools>` */
export class EnableCommand extends MappingCommand {
  readonly name = "enable";
  override readonly aliases = ["on"];
  readonly help = {
    usage: "wirebay enable <servers> for <tools>",
    summary: "Turn servers on for more tools, then sync.",
    examples: ["wirebay enable netlify for cursor vscode"],
  };

  run(input: ParsedCommand, ctx: AppContext): number {
    const servers = this.servers(input, ctx, "enable");
    const tools = this.tools(input, ctx, "enable");
    const config = ctx.config.load();
    for (const s of servers)
      if (!config.servers[s]) throw new UsageError(`"${s}" hasn't been added yet.`, `Run: wirebay add ${s} to ${tools.join(" ")}`);
    ConfigStore.enable(config, servers, tools);
    if (!input.flags["dry-run"]) ctx.config.save(config);
    ctx.terminal.out(`${ctx.terminal.ok("✓")} enabled ${servers.join(", ")} for ${tools.join(", ")}`);
    return this.syncAfter(input, ctx, tools, servers);
  }
}

/** `wirebay disable <servers> from <tools>` */
export class DisableCommand extends MappingCommand {
  readonly name = "disable";
  override readonly aliases = ["off"];
  readonly help = {
    usage: "wirebay disable <servers> from <tools>",
    summary: "Turn servers off for some tools, then sync.",
    examples: ["wirebay disable aws-api from desktop"],
  };

  run(input: ParsedCommand, ctx: AppContext): number {
    const servers = this.servers(input, ctx, "disable");
    const tools = this.tools(input, ctx, "disable");
    const config = ctx.config.load();
    ConfigStore.disable(config, servers, tools);
    if (!input.flags["dry-run"]) ctx.config.save(config);
    ctx.terminal.out(`${ctx.terminal.ok("✓")} disabled ${servers.join(", ")} for ${tools.join(", ")}`);
    return this.syncAfter(input, ctx, tools, servers);
  }
}

/** `wirebay remove <servers> [from <tools>]` */
export class RemoveCommand extends MappingCommand {
  readonly name = "remove";
  override readonly aliases = ["rm", "delete", "uninstall"];
  readonly help = {
    usage: "wirebay remove <servers> [from <tools>] [--purge]",
    summary: "Remove servers from some tools, or from wirebay and every tool.",
    examples: ["wirebay remove github from cursor", "wirebay remove github"],
  };

  private readonly disable = new DisableCommand();

  async run(input: ParsedCommand, ctx: AppContext): Promise<number> {
    // "remove github from cursor" only takes it out of those tools.
    if (input.tools !== undefined) return this.disable.run(input, ctx);

    const t = ctx.terminal;
    const config = ctx.config.load();
    const state = ctx.state.load();
    const servers = this.servers(input, ctx, "remove");
    const tools = [
      ...new Set(servers.flatMap((s) => [...(config.servers[s]?.tools ?? []), ...StateStore.toolsWithEntries(state, s)])),
    ].sort();
    if (
      !input.flags["dry-run"] &&
      !(await t.confirm(`Remove ${servers.join(", ")} from wirebay${tools.length ? ` and from ${tools.join(", ")}` : ""}?`, input.flags))
    ) {
      t.out(t.dim("Cancelled. Pass --yes to skip this question."));
      return ExitCode.Error;
    }
    ConfigStore.removeServers(config, servers);
    if (!input.flags["dry-run"]) ctx.config.save(config);
    const code = tools.length
      ? this.syncAfter({ ...input, flags: { ...input.flags, "no-sync": false } }, ctx, tools, servers)
      : ExitCode.Ok;
    const presets = ctx.servers.presets();
    for (const s of servers) {
      if (input.flags.purge && !input.flags["dry-run"] && ctx.servers.deleteUserDefinition(s))
        t.out(`${t.ok("✓")} deleted your definition of ${s}`);
      else if (!presets.has(s))
        t.out(t.dim(`  Your definition of ${s} is kept in ~/.wirebay/servers/${s}.json (delete with --purge). Secrets are kept too.`));
    }
    t.out(`${t.ok("✓")} removed ${servers.join(", ")}`);
    return code;
  }
}
