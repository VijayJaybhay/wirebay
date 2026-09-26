/**
 * Which tools read which other tools' MCP config files, built from every manifest's `alsoReads`.
 * @module
 */

import type { ServerMapOps } from "../store/ServerMapOps.ts";
import type { ConfigRead, ScopeName } from "../types.ts";
import type { Tool } from "./Tool.ts";

/** One reader of another tool's config file. */
export interface ConfigReader {
  /** The tool that reads the file. */
  reader: Tool;
  /** How and when it reads it. */
  read: ConfigRead;
}

/** A server a tool may also load through another tool's config file. */
export interface IndirectServer {
  server: string;
  /** Id of the tool whose file carries the server. */
  via: string;
  read: ConfigRead;
}

/** A server a reader may get through other tools' files. */
export interface Overlap {
  reader: Tool;
  server: string;
  /** The reads that carry it (one per other tool file). */
  via: ConfigRead[];
  /** True when the server is also enabled for the reader itself (so it may appear twice). */
  direct: boolean;
}

/**
 * The "who reads whose MCP config" graph.
 *
 * wirebay always writes each tool's own file; this graph is used to *tell* the user when a tool may
 * also load a server through another tool's file (so it may appear twice), and to make a location
 * opt-in when a reader can't parse it (a `compatible: false` read).
 *
 * @example
 * graph.readersOf("claude-code", "project"); // Copilot CLI, VS Code, Visual Studio, Qoder, Devin, Warp
 * graph.isOptIn("visual-studio", "user");    // true: Claude Code reads ~/.mcp.json but can't parse it
 */
export class ConfigReadGraph {
  private readonly tools: Tool[];

  /** @param tools - Every known tool (from the tool registry). */
  constructor(tools: Tool[]) {
    this.tools = tools;
  }

  /** Other tools' files this tool reads besides its own. */
  sourcesOf(toolId: string): ConfigRead[] {
    return this.tools.find((t) => t.id === toolId)?.alsoReads ?? [];
  }

  /** Tools that also read `toolId`'s config file for `scope`. */
  readersOf(toolId: string, scope: ScopeName): ConfigReader[] {
    return this.tools.flatMap((reader) =>
      reader.alsoReads.filter((read) => read.tool === toolId && read.scope === scope).map((read) => ({ reader, read })),
    );
  }

  /** Readers that report an error for this file because they expect a different structure. */
  conflictsFor(toolId: string, scope: ScopeName): ConfigReader[] {
    return this.readersOf(toolId, scope).filter((r) => !r.read.compatible);
  }

  /** True when writing this location breaks another tool, so it is only written when named explicitly. */
  isOptIn(toolId: string, scope: ScopeName): boolean {
    return this.conflictsFor(toolId, scope).length > 0;
  }

  /**
   * For each reader and server: the other tools' `scope` files that may also give the reader that
   * server. `direct` is true when the server is enabled for the reader itself too, so it may appear
   * twice there.
   * @param readerIds - Readers to look at.
   * @param options.includeSettings - Also count reads that need a reader setting turned on.
   */
  overlaps(readerIds: string[], scope: ScopeName, desired: ServerMapOps, options: { includeSettings?: boolean } = {}): Overlap[] {
    const out: Overlap[] = [];
    for (const readerId of readerIds) {
      const reader = this.tools.find((t) => t.id === readerId);
      if (!reader) continue;
      const byServer = new Map<string, ConfigRead[]>();
      for (const s of this.indirectServers(readerId, scope, desired)) {
        if (s.read.when === "setting" && !options.includeSettings) continue;
        byServer.set(s.server, [...(byServer.get(s.server) ?? []), s.read]);
      }
      for (const [server, via] of byServer) out.push({ reader, server, via, direct: desired.toolsOf(server).includes(readerId) });
    }
    return out;
  }

  /**
   * Servers a tool may also load through other tools' files in `scope`: for every compatible read of
   * a `scope` file, the servers enabled for that file's tool.
   * @param desired - The desired state of `scope`.
   */
  indirectServers(toolId: string, scope: ScopeName, desired: ServerMapOps): IndirectServer[] {
    return this.sourcesOf(toolId)
      .filter((read) => read.scope === scope && read.compatible)
      .flatMap((read) => desired.serversForTool(read.tool).map((server) => ({ server, via: read.tool, read })));
  }
}
