// `wirebay add <server> [to <tools>]`: add a preset or a custom server, enable it for tools,
// ask for its secrets, and sync.
//   wirebay add github to all
//   wirebay add linear --npx @linear/mcp --secret LINEAR_API_KEY --to codex,claude

import type { ParsedCommand } from "../cli/parse.ts";
import { askSecret, c, canPrompt, note, out } from "../cli/ui.ts";
import { EXIT, UsageError } from "../core/errors.ts";
import { ensureSecretsFile, EnvFileBackend, mask, secrets } from "../core/secrets.ts";
import { assertValidServerName, getServer, loadServers, requiredKeys, saveUserServer } from "../core/servers.ts";
import { loadConfig, saveConfig } from "../core/store.ts";
import { runSync } from "../core/sync.ts";
import { loadTools, toolAliasMap } from "../core/tools.ts";
import type { ArgSpec, Launch, ServerDef } from "../core/types.ts";
import { printOutcome, scopeOf, toolsForAdd } from "./context.ts";

const SOURCE_FLAGS = ["npx", "uvx", "docker", "url", "command"] as const;

function list(v: unknown): string[] {
  return Array.isArray(v) ? (v as string[]) : [];
}

/** Build a custom server definition from --npx/--uvx/--docker/--url/--command flags. */
export function customServerFromFlags(name: string, flags: ParsedCommand["flags"]): ServerDef {
  const given = SOURCE_FLAGS.filter((f) => flags[f]);
  if (given.length !== 1) {
    throw new UsageError(
      given.length ? `Use only one of --${given.join(", --")}.` : `"${name}" is not a built-in server, so wirebay needs to know how to start it.`,
      `Examples:\n  wirebay add ${name} --npx @scope/package\n  wirebay add ${name} --uvx python-package\n  wirebay add ${name} --docker image/name\n  wirebay add ${name} --url https://example.com/mcp\n(See \`wirebay presets\` for built-in servers.)`,
    );
  }
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
    description: (flags.description as string | undefined) ?? `Custom server added with wirebay add`,
    launch,
    secrets: [...required.map((key) => ({ key, required: true })), ...optional.map((key) => ({ key }))],
    ...(Object.keys(env).length ? { env } : {}),
    status: "beta",
  };
}

export async function add(cmd: ParsedCommand): Promise<number> {
  const config = loadConfig();
  const known = loadServers();
  const names: string[] = [];
  const hasSource = SOURCE_FLAGS.some((f) => cmd.flags[f]);

  if (cmd.servers === "all") throw new UsageError("`add all` is ambiguous.", "Name the servers to add, e.g. wirebay add github netlify");
  for (const s of cmd.servers ?? []) names.push(s);

  // A new custom server name.
  if (cmd.rest.length) {
    if (cmd.rest.length > 1) throw new UsageError(`Add one custom server at a time (got ${cmd.rest.join(", ")}).`);
    const name = cmd.rest[0]!.toLowerCase();
    assertValidServerName(name, toolAliasMap(loadTools()).keys());
    const def = customServerFromFlags(name, cmd.flags);
    const file = saveUserServer(def);
    out(`${c.ok("✓")} defined ${c.bold(name)} ${c.dim(file)}`);
    names.push(name);
  } else if (hasSource && names.length) {
    throw new UsageError(`"${names[0]}" already exists, so --${SOURCE_FLAGS.find((f) => cmd.flags[f])} can't redefine it.`, `Pick a new name, e.g. wirebay add ${names[0]}-2 ...`);
  }
  if (!names.length) {
    throw new UsageError("Which server?", "Examples: wirebay add github to all · wirebay add my-server --npx @scope/package\nSee built-in servers: wirebay presets");
  }

  if (cmd.flags.variant) {
    if (names.length !== 1) throw new UsageError("--variant works with one server at a time.");
    const def = getServer(names[0]!, known);
    const variant = String(cmd.flags.variant);
    if (!def.variants?.[variant]) throw new UsageError(`"${def.name}" has no variant "${variant}".`, `Available: ${Object.keys(def.variants ?? {}).join(", ") || "none"}`);
    saveUserServer({ name: def.name, variant } as ServerDef);
  }

  const tools = toolsForAdd(cmd.tools, cmd, config);
  if (!tools.length) {
    throw new UsageError("No AI tools detected on this machine.", "Name them explicitly (wirebay add github to codex) or use --include-missing.");
  }
  for (const name of names) {
    const prev = config.servers[name]?.tools ?? [];
    config.servers[name] = { tools: [...new Set([...prev, ...tools])].sort() };
  }
  saveConfig(config);
  out(`${c.ok("✓")} enabled ${names.map((n) => c.bold(n)).join(", ")} for ${tools.join(", ")}`);

  // Secrets: add placeholders, then ask for the required ones that are missing.
  ensureSecretsFile();
  const all = loadServers();
  for (const name of names) {
    const def = getServer(name, all);
    const backend = secrets();
    if (backend instanceof EnvFileBackend) {
      backend.addPlaceholders(name, (def.secrets ?? []).map((s) => ({ key: s.key, comment: s.description })));
    }
    const missing = requiredKeys(def).filter((k) => !backend.get(k) && !process.env[k]);
    for (const key of missing) {
      const spec = def.secrets?.find((s) => s.key === key);
      if (canPrompt(cmd.flags)) {
        if (spec?.help) out(c.dim(`  How to get it: ${spec.help}`));
        const value = await askSecret(`${name} needs ${key}${spec?.description ? ` (${spec.description})` : ""}`);
        if (value) {
          if (spec?.pattern && !new RegExp(spec.pattern).test(value)) note(c.warn(`! That doesn't look like the expected format. Saved anyway.`));
          backend.set(key, value.trim(), name);
          out(`${c.ok("✓")} saved ${key} ${c.dim(`(${mask(value)})`)}`);
          continue;
        }
      }
      note(c.warn(`! ${name} needs ${key}. Set it with: wirebay secrets set ${key}`));
    }
  }

  if (cmd.flags["no-sync"]) {
    out(c.dim("Not synced (--no-sync). Run `wirebay sync` when ready."));
    return 0;
  }
  const outcome = runSync({
    tools,
    servers: names,
    scope: scopeOf(cmd, config),
    force: !!cmd.flags.force,
    dryRun: !!cmd.flags["dry-run"],
    includeMissing: !!cmd.flags["include-missing"],
  });
  const problems = printOutcome(outcome, { dryRun: !!cmd.flags["dry-run"] });
  return problems ? EXIT.conflict : 0;
}
