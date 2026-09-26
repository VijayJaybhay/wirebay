/**
 * `wirebay secrets set|unset|list|path|edit` (`open` is an alias of `edit`)
 * @module
 */

import { spawnSync } from "node:child_process";
import type { AppContext } from "../app/AppContext.ts";
import type { ParsedCommand } from "../cli/CommandParser.ts";
import { ExitCode, UsageError, WirebayError } from "../core/errors.ts";
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
    summary: "Manage the central secrets file: set keys one at a time, or open it in your editor (edit). Values are never printed.",
    examples: [
      "wirebay secrets edit",
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
      case "open":
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
    const enabled = new Set(ctx.desired.allServerNames());
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

  /**
   * Open `secrets.env` in an editor. When the editor waits until it's closed, report what changed
   * (key names only), what is still missing, and which tools to restart. Tokens need no sync:
   * tools read them when they start a server.
   */
  private edit(ctx: AppContext): number {
    const t = ctx.terminal;
    const file = ctx.secrets.location;
    ctx.secrets.ensureExists();
    const before = ctx.secrets.all();
    const editor = this.editorFor(ctx);
    t.out(t.dim(`Opening ${file} in ${editor.label}…`));
    const started = Date.now();
    const result = spawnSync(`${editor.command} "${file}"`, { stdio: "inherit", shell: true });
    if (result.error ?? (result.status !== 0 && result.status !== null)) {
      throw new WirebayError(`Could not open an editor (${editor.command}).`, {
        hint: `Set the EDITOR environment variable, or open the file yourself: ${file}`,
      });
    }
    // GUI editors return right away; Windows 11 Notepad may too, instead of when the file is closed.
    const returnedEarly = editor.mayReturnEarly === true && Date.now() - started < SecretsCommand.editorReturnedEarlyMs;
    if (!editor.waits || returnedEarly) {
      t.out("Fill in the empty KEY= lines and save the file. Each key has a comment saying how to get it.");
      t.out(t.dim("Tools read secrets when they start a server, so no sync is needed. Check with: wirebay secrets list"));
      return ExitCode.Ok;
    }
    this.reportEdit(before, ctx.secrets.all(), ctx);
    return ExitCode.Ok;
  }

  /** Notepad returning faster than this didn't wait for the file to be closed. */
  private static readonly editorReturnedEarlyMs = 1500;

  /**
   * The editor to use: `VISUAL`/`EDITOR`, else Notepad (Windows), the default text editor (macOS),
   * the desktop's default app or `nano`/`vi` (Linux).
   */
  private editorFor(ctx: AppContext): { command: string; label: string; waits: boolean; mayReturnEarly?: boolean } {
    const visual = nonEmpty(ctx.env.VISUAL);
    const chosen = visual ?? nonEmpty(ctx.env.EDITOR);
    // The label names the variable, not its value, which is a whole command line.
    if (chosen) return { command: chosen, label: visual ? "$VISUAL" : "$EDITOR", waits: true };
    if (ctx.paths.os === "win32") return { command: "notepad", label: "Notepad", waits: true, mayReturnEarly: true };
    if (ctx.paths.os === "darwin") return { command: "open -t", label: "your default text editor", waits: false };
    const desktop = nonEmpty(ctx.env.DISPLAY) ?? nonEmpty(ctx.env.WAYLAND_DISPLAY);
    if (desktop && ctx.resolver.resolve("xdg-open")) return { command: "xdg-open", label: "your default text editor", waits: false };
    const terminalEditor = ctx.resolver.resolve("nano") ? "nano" : "vi";
    return { command: terminalEditor, label: terminalEditor, waits: true };
  }

  /** After editing: changed key names, required keys still missing, and tools to restart. */
  private reportEdit(before: Record<string, string>, after: Record<string, string>, ctx: AppContext): void {
    const t = ctx.terminal;
    const changed = [...new Set([...Object.keys(before), ...Object.keys(after)])].filter((k) => before[k] !== after[k]).sort();
    t.out(changed.length ? `${t.ok("✓")} updated: ${changed.join(", ")}` : t.dim("No changes."));

    const added = ctx.desired.allServerNames().filter((s) => ctx.servers.has(s));
    for (const server of added) {
      const def = ctx.servers.get(server);
      for (const key of def.requiredKeys().filter((k) => !after[k] && !ctx.env[k])) {
        const help = def.secretSpec(key)?.help;
        t.out(`${t.warn("!")} ${server} still needs ${key}${help ? t.dim(`  How to get it: ${help}`) : ""}`);
      }
    }

    const affected = added.filter((s) =>
      ctx.servers
        .get(s)
        .declaredKeys()
        .some((k) => changed.includes(k)),
    );
    const tools = [...new Set(affected.flatMap((s) => [...ctx.desired.servers("user").toolsOf(s), ...this.projectToolsOf(s, ctx)]))].map(
      (id) => (ctx.tools.aliasMap().has(id) ? ctx.tools.get(id).name : id),
    );
    if (tools.length) {
      t.out(`No sync needed. Restart ${tools.join(", ")} (or reload their MCP servers) to use the new values.`);
    } else if (changed.length) {
      t.out(t.dim("No sync needed: tools read secrets the next time they start a server."));
    }
  }

  /** Tools a server is enabled for in the current project, if there is a project config. */
  private projectToolsOf(server: string, ctx: AppContext): string[] {
    return ctx.project.exists() ? ctx.desired.servers("project").toolsOf(server) : [];
  }
}
