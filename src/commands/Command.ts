/**
 * The Command pattern: every CLI verb is a class with its own name, aliases, help and `run`.
 * @module
 */

import type { AppContext } from "../app/AppContext.ts";
import type { ParsedCommand } from "../cli/CommandParser.ts";

/** Help text shown by `wirebay help <command>` and in the generated CLI reference. */
export interface CommandHelp {
  /** One-line usage, e.g. `wirebay sync [servers] [to <tools>]`. */
  usage: string;
  /** What the command does, in one sentence. */
  summary: string;
  /** Example command lines. */
  examples: string[];
}

/**
 * Base class for commands. Subclasses declare their metadata as fields and implement
 * {@link Command.run}.
 *
 * @example
 * class HelloCommand extends Command {
 *   readonly name = "hello";
 *   readonly help = { usage: "wirebay hello", summary: "Say hello.", examples: ["wirebay hello"] };
 *   async run(_input: ParsedCommand, ctx: AppContext) {
 *     ctx.terminal.out("hello");
 *     return ExitCode.Ok;
 *   }
 * }
 */
export abstract class Command {
  /** Canonical verb. */
  abstract readonly name: string;
  /** Other spellings of the verb. */
  readonly aliases: readonly string[] = [];
  /** Help text. */
  abstract readonly help: CommandHelp;
  /** True when the command's words are servers and tools (classified by the parser). */
  readonly targeted: boolean = false;
  /** True when the command accepts words that aren't servers or tools (e.g. a new server name). */
  readonly acceptsFreeWords: boolean = false;
  /** Hidden commands are not listed in `wirebay help`. */
  readonly hidden: boolean = false;

  /**
   * Execute the command.
   * @param input - The parsed command line.
   * @param ctx - Services.
   * @returns The process exit code.
   */
  abstract run(input: ParsedCommand, ctx: AppContext): Promise<number>;
}
