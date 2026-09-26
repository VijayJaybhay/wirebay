/**
 * `wirebay doctor [servers|tools]`
 * @module
 */

import type { AppContext } from "../app/AppContext.ts";
import type { ParsedCommand } from "../cli/CommandParser.ts";
import { Doctor, type DoctorCheck } from "../core/doctor/Doctor.ts";
import { ExitCode } from "../core/errors.ts";
import { Command } from "./Command.ts";

/** Checks prerequisites, secrets, permissions and tool files, and starts each server for a real MCP handshake. */
export class DoctorCommand extends Command {
  readonly name = "doctor";
  override readonly aliases = ["check"];
  override readonly targeted = true;
  readonly help = {
    usage: "wirebay doctor [servers|tools] [--offline] [--json]",
    summary: "Check prerequisites, secrets, permissions, tool files, and start each server for a real MCP handshake.",
    examples: ["wirebay doctor", "wirebay doctor github", "wirebay doctor --offline"],
  };

  async run(input: ParsedCommand, ctx: AppContext): Promise<number> {
    const t = ctx.terminal;
    const json = !!input.flags.json;
    // A handshake can take a minute on first run (npx/uvx download the server), so show progress.
    const progress = json ? undefined : t.progress("Checking your setup…");
    const print = (c: DoctorCheck): void => {
      if (json) return;
      progress?.update("Checking…");
      const icon = c.status === "ok" ? t.ok("✓") : c.status === "warn" ? t.warn("!") : t.err("✗");
      t.out(`${icon} ${t.dim(c.area + ":")} ${c.name}${c.detail ? t.dim(`  ${c.detail}`) : ""}`);
      if (c.fix && c.status !== "ok") t.out(`    ${t.cyan("fix:")} ${c.fix.replace(/\n/g, "\n         ")}`);
    };
    let checks: DoctorCheck[];
    try {
      checks = await new Doctor(ctx).run({
        servers: Array.isArray(input.servers) ? input.servers : undefined,
        tools: Array.isArray(input.tools) ? input.tools : undefined,
        offline: !!input.flags.offline,
        timeoutSeconds: Number(input.flags.timeout ?? 90),
        onCheck: print,
        onStart: (server) => {
          progress?.update(`Starting ${server} for a test connection (the first run may download it)…`);
        },
      });
    } finally {
      progress?.stop();
    }
    const fails = checks.filter((c) => c.status === "fail").length;
    const warns = checks.filter((c) => c.status === "warn").length;
    if (json) t.json({ ok: fails === 0, fails, warnings: warns, checks });
    else
      t.out(
        fails
          ? t.err(`\n${String(fails)} problem(s), ${String(warns)} warning(s).`)
          : t.ok(`\nAll good${warns ? ` (${String(warns)} warning(s))` : ""}.`),
      );
    return fails ? ExitCode.DoctorProblems : ExitCode.Ok;
  }
}
