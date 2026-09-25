/**
 * `wirebay run <server>`
 * @module
 */

import type { AppContext } from "../app/AppContext.ts";
import type { ParsedCommand } from "../cli/CommandParser.ts";
import { ExitCode } from "../core/errors.ts";
import { Command } from "./Command.ts";

/**
 * Starts a server with its secrets. This is what tool configs call, so it must never write to
 * stdout (the MCP protocol uses it). {@link app/WirebayApp!WirebayApp} takes a fast path for it before parsing.
 */
export class RunCommand extends Command {
  readonly name = "run";
  readonly help = { usage: "wirebay run <server>", summary: "Start a server with its secrets (this is what tool configs call).", examples: ["wirebay run github"] };

  async run(input: ParsedCommand, ctx: AppContext): Promise<number> {
    const name = input.rest[0];
    if (!name) {
      process.stderr.write("[wirebay] usage: wirebay run <server>\n");
      return ExitCode.Usage;
    }
    return RunCommand.start(name, ctx);
  }

  /** Plan and start a server, returning its exit code. */
  static start(name: string, ctx: AppContext): Promise<number> {
    return ctx.launcher.run(name, () => ctx.planner.plan(ctx.servers.get(name), ctx.secrets.all(), ctx.env));
  }
}
