/**
 * The application: registers commands, parses the command line, runs the command, and turns
 * errors into friendly messages and exit codes.
 * @module
 */

import { CommandParser, type Vocabulary } from "../cli/CommandParser.ts";
import { AddCommand } from "../commands/AddCommand.ts";
import { CommandRegistry } from "../commands/CommandRegistry.ts";
import { DoctorCommand } from "../commands/DoctorCommand.ts";
import { DisableCommand, EnableCommand, RemoveCommand } from "../commands/EnableCommands.ts";
import { ExportCommand } from "../commands/ExportCommand.ts";
import { HelpCommand, VersionCommand } from "../commands/HelpCommand.ts";
import { InitCommand } from "../commands/InitCommand.ts";
import { ListCommand } from "../commands/ListCommand.ts";
import { PresetsCommand } from "../commands/PresetsCommand.ts";
import { RestoreCommand } from "../commands/RestoreCommand.ts";
import { RunCommand } from "../commands/RunCommand.ts";
import { SecretsCommand } from "../commands/SecretsCommand.ts";
import { SyncCommand } from "../commands/SyncCommand.ts";
import { ToolsCommand } from "../commands/ToolsCommand.ts";
import { UnsyncCommand } from "../commands/UnsyncCommand.ts";
import { ExitCode, WirebayError } from "../core/errors.ts";
import { AppContext } from "./AppContext.ts";

/**
 * The wirebay CLI.
 *
 * @example
 * const code = await new WirebayApp().run(["sync", "github", "to", "codex"]);
 */
export class WirebayApp {
  /** Every command, in the order shown by `wirebay help`. */
  readonly registry: CommandRegistry;
  private readonly ctx: AppContext;

  /** @param ctx - Services (a fresh default context when omitted). */
  constructor(ctx: AppContext = new AppContext()) {
    this.ctx = ctx;
    this.registry = WirebayApp.createRegistry();
  }

  /** The registry with every built-in command. */
  static createRegistry(): CommandRegistry {
    const registry = new CommandRegistry();
    registry
      .register(new InitCommand())
      .register(new AddCommand())
      .register(new SyncCommand())
      .register(new ExportCommand())
      .register(new EnableCommand())
      .register(new DisableCommand())
      .register(new RemoveCommand())
      .register(new UnsyncCommand())
      .register(new ListCommand())
      .register(new ToolsCommand())
      .register(new PresetsCommand())
      .register(new SecretsCommand())
      .register(new DoctorCommand())
      .register(new RestoreCommand())
      .register(new RunCommand())
      .register(new VersionCommand());
    registry.register(new HelpCommand(registry));
    return registry;
  }

  /** The parser's view of known servers and tools. */
  vocabulary(): Vocabulary {
    const servers = this.ctx.servers.all();
    const aliases = this.ctx.tools.aliasMap();
    return {
      isServer: (name) => servers.has(name),
      toolId: (name) => aliases.get(name),
      words: () => [...servers.keys(), ...aliases.keys()],
    };
  }

  /**
   * Run one command line (without the program name).
   * @returns The exit code. Errors are printed, never thrown.
   */
  async run(argv: string[]): Promise<number> {
    try {
      // `run` is on the hot path of every tool and must never write to stdout: skip the parser.
      if (argv[0] === "run") {
        if (!argv[1]) {
          process.stderr.write("[wirebay] usage: wirebay run <server>\n");
          return ExitCode.Usage;
        }
        return await RunCommand.start(argv[1], this.ctx);
      }
      const parser = new CommandParser(this.registry, this.vocabulary());
      const input = parser.parse(argv);
      const command = this.registry.find(input.verb)!;
      if (!command.hidden && !input.flags.json) this.ctx.terminal.note(this.ctx.terminal.dim(parser.describe(input)));
      return await command.run(input, this.ctx);
    } catch (err) {
      return this.report(err);
    }
  }

  /** Print an error with its hint, and choose the exit code. */
  private report(err: unknown): number {
    const t = this.ctx.terminal;
    if (err instanceof WirebayError) {
      t.note(`${t.err("error:")} ${err.message}`);
      if (err.hint) t.note(`${t.cyan("hint:")} ${err.hint.replace(/\n/g, "\n      ")}`);
      return err.exitCode;
    }
    t.note(`${t.err("unexpected error:")} ${(err as Error)?.stack ?? String(err)}`);
    t.note("Please report it: https://github.com/VijayJaybhay/wirebay/issues");
    return ExitCode.Error;
  }
}
