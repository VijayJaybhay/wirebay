/**
 * `wirebay init [--project | --dir <path>]`
 * @module
 */

import { mkdirSync } from "node:fs";
import type { AppContext } from "../app/AppContext.ts";
import type { ParsedCommand } from "../cli/CommandParser.ts";
import { ExitCode } from "../core/errors.ts";
import { ExecutableResolver } from "../core/platform/ExecutableResolver.ts";
import { Command } from "./Command.ts";
import { TargetSelector } from "./support/TargetSelector.ts";

/**
 * Creates `~/.wirebay`, the secrets file, remembers executable paths, and detects installed tools.
 * With `--project` (or `--dir <path>`) it also creates the project's `.wirebay.json`.
 */
export class InitCommand extends Command {
  /** Executables whose absolute paths are remembered (GUI apps often lack a shell PATH). */
  static readonly remembered = ["npx", "uvx", "docker", "claude", "codex"];

  readonly name = "init";
  override readonly aliases = ["setup"];
  readonly help = {
    usage: "wirebay init [--project | --dir <path>]",
    summary: "Create ~/.wirebay, the secrets file, and detect installed tools (--project: also this project's .wirebay.json).",
    examples: ["wirebay init", "wirebay init --project", "wirebay init --dir ~/code/my-app"],
  };

  run(input: ParsedCommand, ctx: AppContext): number {
    const { paths, terminal: t } = ctx;
    const forProject = new TargetSelector(ctx, input).explicitScope() === "project";
    if (forProject) ctx.project.assertUsableRoot();
    mkdirSync(paths.home, { recursive: true });
    ctx.permissions.restrict(paths.home);
    for (const dir of [paths.serversDir, paths.toolsDir, paths.backupsDir, paths.logsDir, paths.credentialsDir])
      mkdirSync(dir, { recursive: true });
    ctx.permissions.restrict(paths.credentialsDir);
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
    const projectCreated = forProject ? ctx.project.create() : undefined;

    if (input.flags.json) {
      t.json({
        home: paths.home,
        secretsCreated: createdSecrets,
        detectedTools: detected,
        paths: config.paths,
        ...(forProject ? { projectFile: ctx.project.file, projectCreated } : {}),
      });
      return ExitCode.Ok;
    }
    t.out(`${t.ok("✓")} wirebay home: ${paths.home}`);
    t.out(
      `${t.ok("✓")} secrets file: ${paths.secretsFile} ${createdSecrets ? t.dim("(created, readable only by you)") : t.dim("(already there, untouched)")}`,
    );
    t.out(`${t.ok("✓")} detected tools: ${detected.length ? detected.join(", ") : t.warn("none")}`);
    if (forProject) {
      t.out(
        `${t.ok("✓")} project config: ${ctx.project.file} ${projectCreated ? t.dim("(created: commit it to share with your team)") : t.dim("(already there, untouched)")}`,
      );
    }
    const missing = ["npx", "uvx", "docker"].filter((e) => !config.paths[e]);
    if (missing.length) t.out(t.dim(`  not found (only needed by some servers): ${missing.join(", ")}`));
    t.out("");
    t.out(t.bold("Next:"));
    if (forProject) t.out(`  wirebay add github --project    ${t.dim("# add a server to this project's tool configs")}`);
    else t.out(`  wirebay add github to all      ${t.dim("# add a server to every detected tool")}`);
    t.out(`  wirebay presets                ${t.dim("# see built-in servers")}`);
    t.out(`  wirebay doctor                 ${t.dim("# check everything works")}`);
    return ExitCode.Ok;
  }
}
