/**
 * `wirebay init`
 * @module
 */

import { mkdirSync } from "node:fs";
import type { AppContext } from "../app/AppContext.ts";
import type { ParsedCommand } from "../cli/CommandParser.ts";
import { ExitCode } from "../core/errors.ts";
import { ExecutableResolver } from "../core/platform/ExecutableResolver.ts";
import { FilePermissions } from "../core/platform/FilePermissions.ts";
import { Command } from "./Command.ts";

/** Creates `~/.wirebay`, the secrets file, remembers executable paths, and detects installed tools. */
export class InitCommand extends Command {
  /** Executables whose absolute paths are remembered (GUI apps often lack a shell PATH). */
  static readonly remembered = ["npx", "uvx", "docker", "claude", "codex"];

  readonly name = "init";
  override readonly aliases = ["setup"];
  readonly help = { usage: "wirebay init", summary: "Create ~/.wirebay, the secrets file, and detect installed tools.", examples: ["wirebay init"] };

  async run(input: ParsedCommand, ctx: AppContext): Promise<number> {
    const { paths, terminal: t } = ctx;
    mkdirSync(paths.home, { recursive: true });
    FilePermissions.restrict(paths.home);
    for (const dir of [paths.serversDir, paths.toolsDir, paths.backupsDir, paths.logsDir, paths.credentialsDir]) mkdirSync(dir, { recursive: true });
    FilePermissions.restrict(paths.credentialsDir);
    const createdSecrets = ctx.secrets.ensureExists();

    const config = ctx.config.load();
    const fresh = new ExecutableResolver(paths, {}, ctx.env);
    for (const exe of InitCommand.remembered) {
      const found = fresh.resolve(exe);
      if (found) config.paths[exe] = found;
    }
    const detected = ctx.tools.detectInstalled(new ExecutableResolver(paths, config.paths, ctx.env));
    if (!config.defaultTools.length) config.defaultTools = detected;
    ctx.config.save(config);

    if (input.flags.json) {
      t.json({ home: paths.home, secretsCreated: createdSecrets, detectedTools: detected, paths: config.paths });
      return ExitCode.Ok;
    }
    t.out(`${t.ok("✓")} wirebay home: ${paths.home}`);
    t.out(`${t.ok("✓")} secrets file: ${paths.secretsFile} ${createdSecrets ? t.dim("(created, readable only by you)") : t.dim("(already there, untouched)")}`);
    t.out(`${t.ok("✓")} detected tools: ${detected.length ? detected.join(", ") : t.warn("none")}`);
    const missing = ["npx", "uvx", "docker"].filter((e) => !config.paths[e]);
    if (missing.length) t.out(t.dim(`  not found (only needed by some servers): ${missing.join(", ")}`));
    t.out("");
    t.out(t.bold("Next:"));
    t.out(`  wirebay add github to all      ${t.dim("# add a server to every detected tool")}`);
    t.out(`  wirebay presets                ${t.dim("# see built-in servers")}`);
    t.out(`  wirebay doctor                 ${t.dim("# check everything works")}`);
    return ExitCode.Ok;
  }
}
