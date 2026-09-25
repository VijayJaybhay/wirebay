// `wirebay init`: create ~/.wirebay, the secrets file, remember executable paths,
// and detect which AI tools are installed.

import { mkdirSync } from "node:fs";
import type { ParsedCommand } from "../cli/parse.ts";
import { c, out, printJson } from "../cli/ui.ts";
import { homePaths, resolveExecutable, wirebayHome } from "../core/paths.ts";
import { ensureSecretsFile, hardenPermissions } from "../core/secrets.ts";
import { loadConfig, saveConfig } from "../core/store.ts";
import { detectInstalled, loadTools } from "../core/tools.ts";

const REMEMBERED_EXECUTABLES = ["npx", "uvx", "docker", "claude", "codex"];

export async function init(cmd: ParsedCommand): Promise<number> {
  const home = wirebayHome();
  mkdirSync(home, { recursive: true });
  hardenPermissions(home);
  for (const dir of [homePaths.servers(), homePaths.tools(), homePaths.backups(), homePaths.logs()]) mkdirSync(dir, { recursive: true });
  mkdirSync(homePaths.credentials(), { recursive: true });
  hardenPermissions(homePaths.credentials());
  const createdSecrets = ensureSecretsFile();

  const config = loadConfig();
  for (const exe of REMEMBERED_EXECUTABLES) {
    const found = resolveExecutable(exe);
    if (found) config.paths[exe] = found;
  }
  const tools = loadTools();
  const detected = detectInstalled(tools, config.paths);
  if (!config.defaultTools.length) config.defaultTools = detected;
  saveConfig(config);

  if (cmd.flags.json) {
    printJson({ home, secretsCreated: createdSecrets, detectedTools: detected, paths: config.paths });
    return 0;
  }
  out(`${c.ok("✓")} wirebay home: ${home}`);
  out(`${c.ok("✓")} secrets file: ${homePaths.secrets()} ${createdSecrets ? c.dim("(created, readable only by you)") : c.dim("(already there, untouched)")}`);
  out(`${c.ok("✓")} detected tools: ${detected.length ? detected.join(", ") : c.warn("none")}`);
  const missing = REMEMBERED_EXECUTABLES.filter((e) => !config.paths[e] && ["npx", "uvx", "docker"].includes(e));
  if (missing.length) out(c.dim(`  not found (only needed by some servers): ${missing.join(", ")}`));
  out("");
  out(c.bold("Next:"));
  out(`  wirebay add github to all      ${c.dim("# add a server to every detected tool")}`);
  out(`  wirebay presets                ${c.dim("# see built-in servers")}`);
  out(`  wirebay doctor                 ${c.dim("# check everything works")}`);
  return 0;
}
