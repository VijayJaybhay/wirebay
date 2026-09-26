/**
 * Human wording for "tool X also reads tool Y's MCP config", shared by `tools`, `list` and sync
 * output so the same fact is always described the same way.
 * @module
 */

import type { Terminal } from "../../cli/Terminal.ts";
import type { Overlap } from "../../core/tools/ConfigReadGraph.ts";
import type { ToolRegistry } from "../../core/tools/ToolRegistry.ts";
import type { ConfigRead, ScopeName } from "../../core/types.ts";

/** Formats config reads and overlaps for humans. */
export class ReadNotes {
  private readonly tools: ToolRegistry;
  private readonly terminal: Terminal;

  constructor(tools: ToolRegistry, terminal: Terminal) {
    this.tools = tools;
    this.terminal = terminal;
  }

  /** `global` or `project`. */
  static scopeLabel(scope: ScopeName): string {
    return scope === "user" ? "global" : "project";
  }

  /** `Claude Code's project config`. */
  fileLabel(read: Pick<ConfigRead, "tool" | "scope">): string {
    return `${this.toolName(read.tool)}'s ${ReadNotes.scopeLabel(read.scope)} config`;
  }

  /** When the read happens, e.g. ` (when "chat.mcp.discovery.enabled" is on)`; empty for `always`. */
  static condition(read: ConfigRead): string {
    if (read.when === "setting") return ` (when "${read.setting ?? "its setting"}" is on)`;
    if (read.when === "approval") return " (after you approve each server)";
    return "";
  }

  /** One line for `wirebay tools <id>`: `Claude Code's project config: reads the workspace-root .mcp.json`. */
  describe(read: ConfigRead): string {
    const incompatible = read.compatible ? "" : this.terminal.warn(" (can't parse it)");
    return `${this.fileLabel(read)}${incompatible}: ${read.note}${ReadNotes.condition(read)}`;
  }

  /**
   * Lines for overlaps, grouped by reader and by the files involved:
   * `Devin may also load github via Claude Code's project config and Cursor's project config`.
   */
  overlapLines(overlaps: Overlap[]): string[] {
    const groups = new Map<string, { reader: string; via: string; servers: string[]; twice: boolean }>();
    for (const o of overlaps) {
      const via = [...new Set(o.via.map((r) => `${this.fileLabel(r)}${ReadNotes.condition(r)}`))].join(" and ");
      const key = `${o.reader.id}|${via}`;
      const group = groups.get(key) ?? { reader: o.reader.name, via, servers: [], twice: false };
      group.servers.push(o.server);
      group.twice ||= o.direct;
      groups.set(key, group);
    }
    return [...groups.values()].map(
      (g) =>
        `${this.terminal.cyan("i")} ${g.reader} may also load ${g.servers.join(", ")} via ${g.via}${g.twice ? this.terminal.dim(" (so it may be listed twice there)") : ""}`,
    );
  }

  private toolName(id: string): string {
    return this.tools.resolveId(id) ? this.tools.get(id).name : id;
  }
}
