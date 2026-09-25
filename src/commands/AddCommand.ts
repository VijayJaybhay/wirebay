/**
 * `wirebay add <server> [to <tools>]`
 * @module
 */

import type { AppContext } from "../app/AppContext.ts";
import type { Flags, ParsedCommand } from "../cli/CommandParser.ts";
import { ExitCode, UsageError } from "../core/errors.ts";
import { ServerRegistry } from "../core/servers/ServerRegistry.ts";
import type { ArgSpec, Launch, ServerDef } from "../core/types.ts";
import { Command } from "./Command.ts";
import { SyncReporter } from "./support/SyncReporter.ts";
import { TargetSelector } from "./support/TargetSelector.ts";

/** Adds a preset or a custom server, enables it for tools, asks for its secrets, and syncs. */
export class AddCommand extends Command {
  /** Flags that define how a custom server starts. */
  static readonly sourceFlags = ["npx", "uvx", "docker", "url", "command"] as const;

  readonly name = "add";
  override readonly aliases = ["install", "new"];
  override readonly targeted = true;
  override readonly acceptsFreeWords = true;
  readonly help = {
    usage: "wirebay add <server> [to <tools>|all] [--global | --project | --dir <path>] [--npx|--uvx|--docker|--url|--command …]",
    summary: "Add a built-in or custom server, ask for its secrets, and sync it.",
    examples: [
      "wirebay add github to all",
      "wirebay add netlify to codex cursor",
      "wirebay add linear --npx @linear/mcp --secret LINEAR_API_KEY --to claude",
      "wirebay add sentry --url https://mcp.sentry.dev/mcp --oauth",
      "wirebay add github --variant docker",
      "wirebay add github to cursor claude --project",
      "wirebay add supabase to vscode --dir ~/code/my-app",
    ],
  };

  async run(input: ParsedCommand, ctx: AppContext): Promise<number> {
    const t = ctx.terminal;
    const selector = new TargetSelector(ctx, input);
    const scope = selector.scope();
    const names = this.collectNames(input, ctx);

    if (input.flags.variant) this.selectVariant(names, String(input.flags.variant), ctx);

    const tools = selector.toolsForAdd(scope);
    if (!tools.length) {
      throw new UsageError(
        scope === "project" ? "No detected tool supports project-level MCP config." : "No AI tools detected on this machine.",
        "Name them explicitly (wirebay add github to cursor) or use --include-missing.",
      );
    }
    ctx.desired.save(scope, ctx.desired.servers(scope).enable(names, tools));
    t.out(`${t.ok("✓")} enabled ${names.map((n) => t.bold(n)).join(", ")} for ${tools.join(", ")} ${t.dim(`(${selector.label(scope)})`)}`);
    if (scope === "project") t.out(t.dim(`  saved in ${ctx.project.file}: commit it to share these servers with your team`));

    await this.collectSecrets(names, input, ctx);

    if (input.flags["no-sync"]) {
      t.out(t.dim("Not synced (--no-sync). Run `wirebay sync` when ready."));
      return ExitCode.Ok;
    }
    const outcome = ctx.sync.run({
      tools,
      servers: names,
      scope,
      force: !!input.flags.force,
      dryRun: !!input.flags["dry-run"],
      includeMissing: !!input.flags["include-missing"],
    });
    return new SyncReporter(t).print(outcome, { dryRun: !!input.flags["dry-run"] }) ? ExitCode.Conflict : ExitCode.Ok;
  }

  /** Known servers from the command line, plus a new custom server defined by flags. */
  private collectNames(input: ParsedCommand, ctx: AppContext): string[] {
    if (input.servers === "all")
      throw new UsageError("`add all` is ambiguous.", "Name the servers to add, e.g. wirebay add github netlify");
    const names = [...(input.servers ?? [])];
    const hasSource = AddCommand.sourceFlags.some((f) => input.flags[f]);
    const [customName, ...extra] = input.rest;
    if (customName !== undefined) {
      if (extra.length) throw new UsageError(`Add one custom server at a time (got ${input.rest.join(", ")}).`);
      const name = customName.toLowerCase();
      ServerRegistry.assertValidName(name, ctx.tools.aliasMap().keys());
      const file = ctx.servers.saveUserDefinition(AddCommand.customDefinition(name, input.flags));
      ctx.terminal.out(`${ctx.terminal.ok("✓")} defined ${ctx.terminal.bold(name)} ${ctx.terminal.dim(file)}`);
      names.push(name);
    } else if (hasSource && names.length) {
      const flag = AddCommand.sourceFlags.find((f) => input.flags[f]) ?? "npx";
      const existing = names.join(", ");
      throw new UsageError(
        `"${existing}" already exists, so --${flag} can't redefine it.`,
        `Pick a new name, e.g. wirebay add my-${flag}-server --${flag} …`,
      );
    }
    if (!names.length) {
      throw new UsageError(
        "Which server?",
        "Examples: wirebay add github to all · wirebay add my-server --npx @scope/package\nSee built-in servers: wirebay presets",
      );
    }
    return names;
  }

  private selectVariant(names: string[], variant: string, ctx: AppContext): void {
    const [only, ...others] = names;
    if (only === undefined || others.length) throw new UsageError("--variant works with one server at a time.");
    const def = ctx.servers.get(only);
    if (!def.variantNames.includes(variant))
      throw new UsageError(`"${def.name}" has no variant "${variant}".`, `Available: ${def.variantNames.join(", ") || "none"}`);
    ctx.servers.saveUserDefinition({ name: def.name, variant });
  }

  /** Add placeholders for each server's keys, then ask for missing required ones (when interactive). */
  private async collectSecrets(names: string[], input: ParsedCommand, ctx: AppContext): Promise<void> {
    const t = ctx.terminal;
    ctx.secrets.ensureExists();
    for (const name of names) {
      const def = ctx.servers.get(name);
      ctx.secrets.addPlaceholders(
        name,
        def.secrets.map((s) => ({ key: s.key, comment: s.description })),
      );
      for (const key of def.requiredKeys().filter((k) => !ctx.secrets.get(k) && !ctx.env[k])) {
        const spec = def.secretSpec(key);
        if (t.canPrompt(input.flags)) {
          if (spec?.help) t.out(t.dim(`  How to get it: ${spec.help}`));
          const value = await t.askSecret(`${name} needs ${key}${spec?.description ? ` (${spec.description})` : ""}`);
          if (value) {
            if (spec?.pattern && !new RegExp(spec.pattern).test(value))
              t.note(t.warn("! That doesn't look like the expected format. Saved anyway."));
            ctx.secrets.set(key, value.trim(), name);
            t.out(`${t.ok("✓")} saved ${key} ${t.dim(`(${ctx.masker.mask(value)})`)}`);
            continue;
          }
        }
        t.note(t.warn(`! ${name} needs ${key}. Set it with: wirebay secrets set ${key}`));
      }
    }
  }

  /**
   * Build a custom server definition from `--npx/--uvx/--docker/--url/--command` and friends.
   * @throws {@link core/errors!UsageError} when zero or several source flags are given.
   */
  static customDefinition(name: string, flags: Flags): ServerDef {
    const given = AddCommand.sourceFlags.filter((f) => flags[f]);
    if (given.length !== 1) {
      throw new UsageError(
        given.length
          ? `Use only one of --${given.join(", --")}.`
          : `"${name}" is not a built-in server, so wirebay needs to know how to start it.`,
        `Examples:\n  wirebay add ${name} --npx @scope/package\n  wirebay add ${name} --uvx python-package\n  wirebay add ${name} --docker image/name\n  wirebay add ${name} --url https://example.com/mcp\n(See \`wirebay presets\` for built-in servers.)`,
      );
    }
    const list = (v: unknown): string[] => (Array.isArray(v) ? (v as string[]) : []);
    const required = list(flags.secret);
    const optional = list(flags["optional-secret"]);
    const env: Record<string, string> = {};
    for (const kv of list(flags.env)) {
      const [k, v] = kv.split(/=(.*)/s, 2) as [string, string | undefined];
      if (!k || v === undefined) throw new UsageError(`--env expects KEY=value, got "${kv}".`);
      env[k] = v;
    }
    const extraArgs: ArgSpec[] = list(flags.arg);
    let launch: Launch;
    switch (given[0]) {
      case "npx":
        launch = { type: "stdio", command: "npx", args: ["-y", String(flags.npx), ...extraArgs] };
        break;
      case "uvx":
        launch = { type: "stdio", command: "uvx", args: [String(flags.uvx), ...extraArgs] };
        break;
      case "docker": {
        const passEnv = [...required, ...optional, ...Object.keys(env)].flatMap((k) => ["-e", k]);
        launch = { type: "stdio", command: "docker", args: ["run", "-i", "--rm", ...passEnv, String(flags.docker), ...extraArgs] };
        break;
      }
      case "command":
        launch = { type: "stdio", command: String(flags.command), args: extraArgs };
        break;
      default: {
        const headers: Record<string, string> = {};
        for (const h of list(flags.header)) {
          const [k, v] = h.split(/:(.*)/s, 2) as [string, string | undefined];
          if (!k || v === undefined) throw new UsageError(`--header expects "Name: value", got "${h}".`);
          headers[k.trim()] = v.trim();
        }
        launch = {
          type: "remote",
          url: String(flags.url),
          ...(Object.keys(headers).length ? { headers } : {}),
          auth: flags.oauth ? { type: "oauth" } : required[0] ? { type: "bearer", secret: required[0] } : { type: "none" },
        };
      }
    }
    return {
      name,
      description: (flags.description as string | undefined) ?? "Custom server added with wirebay add",
      launch,
      secrets: [
        ...required.map((key) => ({ key, required: true, description: `${key} for ${name}` })),
        ...optional.map((key) => ({ key })),
      ],
      ...(Object.keys(env).length ? { env } : {}),
      status: "beta",
    };
  }
}
