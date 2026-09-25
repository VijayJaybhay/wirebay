// `wirebay list [server|tool]`: a server × tool matrix.
//   ✓ synced   ○ enabled, not synced yet   ~ edited by hand since last sync   ! missing required secret

import type { ParsedCommand } from "../cli/parse.ts";
import { c, out, printJson, table } from "../cli/ui.ts";
import { adapterFor } from "../adapters/index.ts";
import { secrets } from "../core/secrets.ts";
import { loadServers, requiredKeys } from "../core/servers.ts";
import { hashEntry, loadConfig, loadState } from "../core/store.ts";
import { targetFor, toolsInConfig } from "../core/sync.ts";
import { getTool, loadTools } from "../core/tools.ts";
import type { Entry } from "../core/types.ts";
import { toolsInState } from "./context.ts";

type Cell = "synced" | "enabled" | "drift" | "stray" | "none";

export async function list(cmd: ParsedCommand): Promise<number> {
  const config = loadConfig();
  const state = loadState();
  const tools = loadTools();
  const servers = loadServers();
  const secretValues = secrets().all();

  const toolIds = Array.isArray(cmd.tools) ? cmd.tools : [...new Set([...toolsInConfig(config), ...toolsInState(state)])].sort();
  const serverNames = Array.isArray(cmd.servers) ? cmd.servers : Object.keys(config.servers).sort();

  // Read each tool file once.
  const current = new Map<string, { entries: Record<string, Entry>; recorded: Record<string, string> }>();
  for (const id of toolIds) {
    const tool = getTool(id, tools);
    for (const scope of ["user", "project"] as const) {
      const target = targetFor(tool, scope);
      if (!target) continue;
      const recorded = Object.values(state.files).find((f) => f.tool === id && f.scope === scope && f.path === target.file)?.entries ?? {};
      if (scope === "project" && !Object.keys(recorded).length) continue;
      let entries: Record<string, Entry> = {};
      try {
        entries = adapterFor(tool).read(target).entries;
      } catch {
        // Unreadable file: show as not synced.
      }
      const prev = current.get(id);
      current.set(id, { entries: { ...prev?.entries, ...entries }, recorded: { ...prev?.recorded, ...recorded } });
    }
  }

  const cell = (server: string, tool: string): Cell => {
    const enabled = config.servers[server]?.tools.includes(tool) ?? false;
    const file = current.get(tool);
    const recordedHash = file?.recorded[server];
    const present = file?.entries[server];
    if (recordedHash && present) {
      if (hashEntry(present) !== recordedHash) return "drift";
      return enabled ? "synced" : "stray";
    }
    return enabled ? "enabled" : "none";
  };

  const rows = serverNames.map((name) => {
    const def = servers.get(name);
    const missing = def ? requiredKeys(def).filter((k) => !secretValues[k] && !process.env[k]) : [];
    return { server: name, known: !!def, missingSecrets: missing, tools: Object.fromEntries(toolIds.map((t) => [t, cell(name, t)])) };
  });

  if (cmd.flags.json) {
    printJson({ tools: toolIds, servers: rows });
    return 0;
  }
  if (!serverNames.length) {
    out("No servers added yet. Start with: wirebay add github to all   (see `wirebay presets`)");
    return 0;
  }
  const symbol: Record<Cell, string> = { synced: c.ok("✓"), enabled: c.warn("○"), drift: c.warn("~"), stray: c.warn("?"), none: c.dim("·") };
  out(
    table(
      ["SERVER", ...toolIds, "SECRETS"],
      rows.map((r) => [
        r.known ? r.server : c.err(`${r.server} (unknown)`),
        ...toolIds.map((t) => symbol[r.tools[t] as Cell]),
        r.missingSecrets.length ? c.err(`! ${r.missingSecrets.join(", ")}`) : c.ok("ok"),
      ]),
    ),
  );
  out(c.dim("\n✓ synced  ○ enabled, run `wirebay sync`  ~ edited by hand  ? synced but disabled  · off"));
  return 0;
}
