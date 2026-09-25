/**
 * `wirebay list [server|tool]`
 * @module
 */

import type { AppContext } from "../app/AppContext.ts";
import type { ParsedCommand } from "../cli/CommandParser.ts";
import { ExitCode } from "../core/errors.ts";
import { ConfigStore } from "../core/store/ConfigStore.ts";
import { StateStore } from "../core/store/StateStore.ts";
import type { Entry } from "../core/types.ts";
import { Command } from "./Command.ts";

/** The status of one server in one tool. */
type Cell = "synced" | "enabled" | "drift" | "stray" | "none";

/**
 * Shows a server × tool matrix:
 * ✓ synced · ○ enabled but not synced · ~ edited by hand · ? synced but disabled · · off.
 */
export class ListCommand extends Command {
  readonly name = "list";
  override readonly aliases = ["ls", "status"];
  override readonly targeted = true;
  readonly help = {
    usage: "wirebay list [server|tool] [--json]",
    summary: "Show which servers are synced to which tools.",
    examples: ["wirebay list", "wirebay ls codex"],
  };

  run(input: ParsedCommand, ctx: AppContext): number {
    const t = ctx.terminal;
    const config = ctx.config.load();
    const state = ctx.state.load();
    const secretValues = ctx.secrets.all();
    const toolIds = Array.isArray(input.tools)
      ? input.tools
      : [...new Set([...ConfigStore.toolsInUse(config), ...StateStore.toolsWithEntries(state)])].sort();
    const serverNames = Array.isArray(input.servers) ? input.servers : Object.keys(config.servers).sort();
    const files = this.readToolFiles(toolIds, ctx);

    const cell = (server: string, tool: string): Cell => {
      const enabled = config.servers[server]?.tools.includes(tool) ?? false;
      const file = files.get(tool);
      const recorded = file?.recorded[server];
      const present = file?.entries[server];
      if (recorded && present) {
        if (ctx.hasher.hash(present) !== recorded) return "drift";
        return enabled ? "synced" : "stray";
      }
      return enabled ? "enabled" : "none";
    };

    const rows = serverNames.map((name) => {
      const known = ctx.servers.has(name);
      const missing = known
        ? ctx.servers
            .get(name)
            .requiredKeys()
            .filter((k) => !secretValues[k] && !ctx.env[k])
        : [];
      const tools: Record<string, Cell> = Object.fromEntries(toolIds.map((id) => [id, cell(name, id)]));
      return { server: name, known, missingSecrets: missing, tools };
    });

    if (input.flags.json) {
      t.json({ tools: toolIds, servers: rows });
      return ExitCode.Ok;
    }
    if (!serverNames.length) {
      t.out("No servers added yet. Start with: wirebay add github to all   (see `wirebay presets`)");
      return ExitCode.Ok;
    }
    const symbol: Record<Cell, string> = {
      synced: t.ok("✓"),
      enabled: t.warn("○"),
      drift: t.warn("~"),
      stray: t.warn("?"),
      none: t.dim("·"),
    };
    t.out(
      t.table(
        ["SERVER", ...toolIds, "SECRETS"],
        rows.map((r) => [
          r.known ? r.server : t.err(`${r.server} (unknown)`),
          ...toolIds.map((id) => symbol[r.tools[id] ?? "none"]),
          r.missingSecrets.length ? t.err(`! ${r.missingSecrets.join(", ")}`) : t.ok("ok"),
        ]),
      ),
    );
    t.out(t.dim("\n✓ synced  ○ enabled, run `wirebay sync`  ~ edited by hand  ? synced but disabled  · off"));
    return ExitCode.Ok;
  }

  /** Read each tool's files once: current entries and what wirebay recorded. */
  private readToolFiles(
    toolIds: string[],
    ctx: AppContext,
  ): Map<string, { entries: Record<string, Entry>; recorded: Record<string, string> }> {
    const state = ctx.state.load();
    const out = new Map<string, { entries: Record<string, Entry>; recorded: Record<string, string> }>();
    for (const id of toolIds) {
      const tool = ctx.tools.get(id);
      for (const scope of tool.scopes) {
        const target = ctx.sync.targetFor(tool, scope);
        if (!target) continue;
        const recorded = StateStore.fileRecord(state, id, scope, target.file)?.entries ?? {};
        if (scope === "project" && !Object.keys(recorded).length) continue;
        let entries: Record<string, Entry> = {};
        try {
          entries = ctx.adapters.for(tool).read(target).entries;
        } catch {
          // Unreadable file: shown as not synced.
        }
        const prev = out.get(id);
        out.set(id, { entries: { ...prev?.entries, ...entries }, recorded: { ...prev?.recorded, ...recorded } });
      }
    }
    return out;
  }
}
