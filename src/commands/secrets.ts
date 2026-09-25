// `wirebay secrets set|unset|list|path|edit`: manage the central secrets file one key at a time.
// Values are never printed in full.

import { spawnSync } from "node:child_process";
import type { ParsedCommand } from "../cli/parse.ts";
import { askSecret, c, canPrompt, note, out, printJson, readStdin, table } from "../cli/ui.ts";
import { UsageError } from "../core/errors.ts";
import { currentOs, homePaths } from "../core/paths.ts";
import { ensureSecretsFile, isValidKey, mask, secrets } from "../core/secrets.ts";
import { loadServers, requiredKeys } from "../core/servers.ts";
import { loadConfig } from "../core/store.ts";
import type { SecretSpec } from "../core/types.ts";

/** key → servers that declare it (with their spec). */
function declaredBy(): Map<string, { server: string; spec: SecretSpec; required: boolean }[]> {
  const map = new Map<string, { server: string; spec: SecretSpec; required: boolean }[]>();
  for (const def of loadServers().values()) {
    const req = new Set(requiredKeys(def));
    for (const spec of def.secrets ?? []) {
      const list = map.get(spec.key) ?? [];
      list.push({ server: def.name, spec, required: req.has(spec.key) });
      map.set(spec.key, list);
    }
  }
  return map;
}

export async function secretsCommand(cmd: ParsedCommand): Promise<number> {
  const [sub = "list", ...args] = cmd.rest;
  switch (sub) {
    case "set":
      return setSecret(args, cmd);
    case "unset":
    case "rm":
    case "remove":
    case "delete":
      return unsetSecret(args);
    case "list":
    case "ls":
      return listSecrets(cmd);
    case "path":
      out(homePaths.secrets());
      return 0;
    case "edit":
      return editSecrets();
    default:
      throw new UsageError(`Unknown secrets command "${sub}".`, "Use: wirebay secrets set|unset|list|path|edit");
  }
}

async function setSecret(args: string[], cmd: ParsedCommand): Promise<number> {
  const [first] = args;
  if (!first) throw new UsageError("Which key?", "Example: wirebay secrets set GITHUB_PERSONAL_ACCESS_TOKEN");
  let key = first;
  let value: string | undefined;
  if (first.includes("=")) {
    [key, value] = first.split(/=(.*)/s, 2) as [string, string];
    note(c.warn("! Passing a secret on the command line can leave it in your shell history. Prefer the prompt or --stdin."));
  }
  if (!isValidKey(key)) throw new UsageError(`"${key}" is not a valid key name.`, "Use letters, digits and underscores, e.g. MY_TOKEN.");
  ensureSecretsFile();
  if (value === undefined && cmd.flags.stdin) value = await readStdin();
  if (value === undefined) {
    if (!canPrompt(cmd.flags)) throw new UsageError(`No value given for ${key}.`, `Pipe it in: <command> | wirebay secrets set ${key} --stdin`);
    value = await askSecret(`Value for ${key}`);
    if (value === undefined) return 1;
  }
  value = value.trim();
  const users = declaredBy().get(key) ?? [];
  for (const u of users) {
    if (u.spec.pattern && value && !new RegExp(u.spec.pattern).test(value)) {
      note(c.warn(`! This doesn't look like a ${u.spec.description ?? key} (expected to match ${u.spec.pattern}). Saved anyway.`));
      break;
    }
  }
  secrets().set(key, value, users[0]?.server);
  out(`${c.ok("✓")} ${key} saved ${c.dim(`(${mask(value)})`)}${users.length ? c.dim(` · used by ${users.map((u) => u.server).join(", ")}`) : ""}`);
  out(c.dim("  Running servers pick it up the next time they start."));
  return 0;
}

function unsetSecret(args: string[]): number {
  const [key] = args;
  if (!key) throw new UsageError("Which key?", "Example: wirebay secrets unset NETLIFY_PERSONAL_ACCESS_TOKEN");
  const removed = secrets().unset(key);
  out(removed ? `${c.ok("✓")} ${key} cleared` : `${key} was not set`);
  return 0;
}

function listSecrets(cmd: ParsedCommand): number {
  const store = secrets();
  const values = store.all();
  const declared = declaredBy();
  const enabled = new Set(Object.keys(loadConfig().servers));
  const keys = new Set([...store.keys(), ...[...declared.entries()].filter(([, us]) => us.some((u) => enabled.has(u.server))).map(([k]) => k)]);
  const rows = [...keys].sort().map((key) => {
    const users = (declared.get(key) ?? []).filter((u) => enabled.has(u.server) || values[key]);
    const required = users.some((u) => u.required && enabled.has(u.server));
    return { key, set: !!values[key], masked: mask(values[key]), usedBy: users.map((u) => u.server), missingRequired: required && !values[key] };
  });
  if (cmd.flags.json) {
    printJson({ file: homePaths.secrets(), secrets: rows });
    return 0;
  }
  out(c.dim(homePaths.secrets()));
  out(
    table(
      ["KEY", "VALUE", "USED BY"],
      rows.map((r) => [r.missingRequired ? c.err(r.key) : r.key, r.set ? r.masked : r.missingRequired ? c.err("missing (required)") : c.dim("(empty)"), r.usedBy.join(", ")]),
    ),
  );
  const missing = rows.filter((r) => r.missingRequired);
  if (missing.length) out(c.warn(`\nSet the missing ones: ${missing.map((m) => `wirebay secrets set ${m.key}`).join("  ·  ")}`));
  return 0;
}

function editSecrets(): number {
  ensureSecretsFile();
  const editor = process.env.VISUAL || process.env.EDITOR || (currentOs() === "win32" ? "notepad" : "vi");
  const r = spawnSync(editor, [homePaths.secrets()], { stdio: "inherit", shell: currentOs() === "win32" });
  return r.status ?? 0;
}
