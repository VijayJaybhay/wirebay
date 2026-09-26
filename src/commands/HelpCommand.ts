/**
 * `wirebay help [command]` and `wirebay --version`.
 * @module
 */

import type { AppContext } from "../app/AppContext.ts";
import type { ParsedCommand } from "../cli/CommandParser.ts";
import { FLAGS } from "../cli/Grammar.ts";
import { ExitCode } from "../core/errors.ts";
import { WirebayPaths } from "../core/platform/WirebayPaths.ts";
import { Command } from "./Command.ts";
import type { CommandRegistry } from "./CommandRegistry.ts";

/** Shows general help, or help for one command (generated from each command's metadata). */
export class HelpCommand extends Command {
  readonly name = "help";
  readonly help = {
    usage: "wirebay help [command]",
    summary: "Show help for wirebay or one command.",
    examples: ["wirebay help", "wirebay help sync"],
  };
  override readonly hidden = true;

  private readonly registry: CommandRegistry;

  /** @param registry - Every command, for listing and per-command help. */
  constructor(registry: CommandRegistry) {
    super();
    this.registry = registry;
  }

  run(input: ParsedCommand, ctx: AppContext): number {
    const t = ctx.terminal;
    const topic = input.rest[0] ? this.registry.find(input.rest[0]) : undefined;
    if (topic) {
      t.out(t.bold(topic.help.usage));
      t.out(`\n${topic.help.summary}`);
      if (topic.aliases.length) t.out(t.dim(`\nAlso: ${topic.aliases.join(", ")}`));
      t.out(`\n${t.bold("Examples")}`);
      for (const e of topic.help.examples) t.out(`  ${e}`);
      return ExitCode.Ok;
    }
    t.out(
      `${t.bold("wirebay")} ${t.dim(VersionCommand.version())}: define MCP servers once, keep secrets in one place, sync to every AI tool.\n`,
    );
    t.out(t.bold("Everyday"));
    t.out("  wirebay add github to all          add a server and sync it everywhere");
    t.out("  wirebay sync [servers] [to tools]  make tool configs match");
    t.out("  wirebay list                       what is synced where");
    t.out("  wirebay secrets set KEY            store a token (asked for, never echoed)");
    t.out("  wirebay doctor                     check everything works\n");
    t.out(t.bold("All commands"));
    for (const c of this.registry.all().filter((x) => !x.hidden)) t.out(`  ${c.name.padEnd(9)} ${c.help.summary}`);
    t.out(`\n${t.bold("Say it your way")}: sync github to codex · push all · rm github from cursor · add netlify on claude`);
    t.out(
      `${t.bold("Common options")}: ${FLAGS.filter((f) => ["dry-run", "yes", "force", "json", "scope"].includes(f.name))
        .map((f) => `--${f.name}${f.short ? `/-${f.short}` : ""}`)
        .join("  ")}`,
    );
    t.out(t.dim(`\nMore: wirebay help <command> · https://github.com/pragnalabs-ai/wirebay#readme`));
    return ExitCode.Ok;
  }
}

/** `wirebay --version` */
export class VersionCommand extends Command {
  readonly name = "version";
  readonly help = { usage: "wirebay --version", summary: "Print the installed version.", examples: ["wirebay --version"] };
  override readonly hidden = true;

  run(_input: ParsedCommand, ctx: AppContext): number {
    ctx.terminal.out(VersionCommand.version());
    return ExitCode.Ok;
  }

  /** The version from package.json. */
  static version(): string {
    return WirebayPaths.packageInfo().version;
  }
}
