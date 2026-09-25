/**
 * `wirebay secrets set|unset|list|path|edit`
 * @module
 */

import { spawnSync } from "node:child_process";
import type { AppContext } from "../app/AppContext.ts";
import type { ParsedCommand } from "../cli/CommandParser.ts";
import { ExitCode, UsageError } from "../core/errors.ts";
import { EnvFileSecretsStore } from "../core/secrets/EnvFileSecretsStore.ts";
import type { SecretSpec } from "../core/types.ts";
import { nonEmpty } from "../core/util/values.ts";
import { Command } from "./Command.ts";

/** Who declares a key, and whether they require it. */
interface KeyUse {
  server: string;
  spec: SecretSpec;
  required: boolean;
}

/** Manages the central secrets file one key at a time. Values are never printed in full. */
export class SecretsCommand extends Command {
  readonly name = "secrets";
  override readonly aliases = ["secret", "keys"];
  readonly help = {
    usage: "wirebay secrets set|unset|list|path|edit [KEY]",
    summary: "Manage the central secrets file, one key at a time. Values are never printed.",
    examples: [
      "wirebay secrets set GITHUB_PERSONAL_ACCESS_TOKEN",
      "echo $TOKEN | wirebay secrets set NETLIFY_PERSONAL_ACCESS_TOKEN --stdin",
      "wirebay secrets list",
    ],
  };

  async run(input: ParsedCommand, ctx: AppContext): Promise<number> {
    const [sub = "list", ...args] = input.rest;
    switch (sub) {
      case "set":
        return this.set(args, input, ctx);
      case "unset":
      case "rm":
      case "remove":
      case "delete":
        return this.unset(args, ctx);
      case "list":
      case "ls":
        return this.list(input, ctx);
      case "path":
        ctx.terminal.out(ctx.secrets.location);
        return ExitCode.Ok;
      case "edit":
        return this.edit(ctx);
      default:
        throw new UsageError(`Unknown secrets command "${sub}".`, "Use: wirebay secrets set|unset|list|path|edit");
    }
  }

  /** Every declared key → the servers using it. */
  private uses(ctx: AppContext): Map<string, KeyUse[]> {
    const map = new Map<string, KeyUse[]>();
    for (const def of ctx.servers.all().values()) {
      const required = new Set(def.requiredKeys());
      for (const spec of def.secrets)
        map.set(spec.key, [...(map.get(spec.key) ?? []), { server: def.name, spec, required: required.has(spec.key) }]);
    }
    return map;
  }

  private async set(args: string[], input: ParsedCommand, ctx: AppContext): Promise<number> {
    const t = ctx.terminal;
    const [first] = args;
    if (!first) throw new UsageError("Which key?", "Example: wirebay secrets set GITHUB_PERSONAL_ACCESS_TOKEN");
    let key = first;
    let value: string | undefined;
    if (first.includes("=")) {
      [key, value] = first.split(/=(.*)/s, 2) as [string, string];
      t.note(t.warn("! Passing a secret on the command line can leave it in your shell history. Prefer the prompt or --stdin."));
    }
    if (!EnvFileSecretsStore.isValidKey(key))
      throw new UsageError(`"${key}" is not a valid key name.`, "Use letters, digits and underscores, e.g. MY_TOKEN.");
    ctx.secrets.ensureExists();
    if (value === undefined && input.flags.stdin) value = await t.readStdin();
    if (value === undefined) {
      if (!t.canPrompt(input.flags))
        throw new UsageError(`No value given for ${key}.`, `Pipe it in: <command> | wirebay secrets set ${key} --stdin`);
      value = await t.askSecret(`Value for ${key}`);
      if (value === undefined) return ExitCode.Error;
    }
    value = value.trim();
    const users = this.uses(ctx).get(key) ?? [];
    const withPattern = users.find((u) => u.spec.pattern && value && !new RegExp(u.spec.pattern).test(value));
    if (withPattern)
      t.note(
        t.warn(
          `! This doesn't look like a ${withPattern.spec.description ?? key} (expected to match ${withPattern.spec.pattern ?? "its usual format"}). Saved anyway.`,
        ),
      );
    ctx.secrets.set(key, value, users[0]?.server);
    t.out(
      `${t.ok("✓")} ${key} saved ${t.dim(`(${ctx.masker.mask(value)})`)}${users.length ? t.dim(` · used by ${users.map((u) => u.server).join(", ")}`) : ""}`,
    );
    t.out(t.dim("  Running servers pick it up the next time they start."));
    return ExitCode.Ok;
  }

  private unset(args: string[], ctx: AppContext): number {
    const [key] = args;
    if (!key) throw new UsageError("Which key?", "Example: wirebay secrets unset NETLIFY_PERSONAL_ACCESS_TOKEN");
    ctx.terminal.out(ctx.secrets.unset(key) ? `${ctx.terminal.ok("✓")} ${key} cleared` : `${key} was not set`);
    return ExitCode.Ok;
  }

  private list(input: ParsedCommand, ctx: AppContext): number {
    const t = ctx.terminal;
    const values = ctx.secrets.all();
    const uses = this.uses(ctx);
    const enabled = new Set(Object.keys(ctx.config.load().servers));
    const keys = new Set([
      ...ctx.secrets.keys(),
      ...[...uses.entries()].filter(([, us]) => us.some((u) => enabled.has(u.server))).map(([k]) => k),
    ]);
    const rows = [...keys].sort().map((key) => {
      const users = (uses.get(key) ?? []).filter((u) => enabled.has(u.server) || values[key]);
      const missingRequired = users.some((u) => u.required && enabled.has(u.server)) && !values[key];
      return { key, set: !!values[key], masked: ctx.masker.mask(values[key]), usedBy: users.map((u) => u.server), missingRequired };
    });
    if (input.flags.json) {
      t.json({ file: ctx.secrets.location, secrets: rows });
      return ExitCode.Ok;
    }
    t.out(t.dim(ctx.secrets.location));
    t.out(
      t.table(
        ["KEY", "VALUE", "USED BY"],
        rows.map((r) => [
          r.missingRequired ? t.err(r.key) : r.key,
          r.set ? r.masked : r.missingRequired ? t.err("missing (required)") : t.dim("(empty)"),
          r.usedBy.join(", "),
        ]),
      ),
    );
    const missing = rows.filter((r) => r.missingRequired);
    if (missing.length) t.out(t.warn(`\nSet the missing ones: ${missing.map((m) => `wirebay secrets set ${m.key}`).join("  ·  ")}`));
    return ExitCode.Ok;
  }

  private edit(ctx: AppContext): number {
    ctx.secrets.ensureExists();
    const windows = ctx.paths.os === "win32";
    const editor = nonEmpty(ctx.env.VISUAL) ?? nonEmpty(ctx.env.EDITOR) ?? (windows ? "notepad" : "vi");
    return spawnSync(editor, [ctx.secrets.location], { stdio: "inherit", shell: windows }).status ?? ExitCode.Ok;
  }
}
