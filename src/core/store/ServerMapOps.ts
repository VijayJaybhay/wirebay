/**
 * Operations on a {@link ServerMap} (servers → tools), shared by the global config and project
 * configs.
 * @module
 */

import type { ServerMap } from "../types.ts";

/** Immutable helpers for reading and changing which servers are enabled for which tools. */
export class ServerMapOps {
  private readonly servers: ServerMap;

  /** @param servers - The map to work on (never modified; methods return new maps). */
  constructor(servers: ServerMap) {
    this.servers = servers;
  }

  /** The underlying map. */
  get map(): ServerMap {
    return this.servers;
  }

  /** Every server name, sorted. */
  names(): string[] {
    return Object.keys(this.servers).sort();
  }

  /** True when the server has been added (with or without tools). */
  has(server: string): boolean {
    return server in this.servers;
  }

  /** Tools a server is enabled for. */
  toolsOf(server: string): string[] {
    return this.servers[server]?.tools ?? [];
  }

  /** Server names enabled for a tool, sorted. */
  serversForTool(toolId: string): string[] {
    return Object.entries(this.servers)
      .filter(([, s]) => s.tools.includes(toolId))
      .map(([name]) => name)
      .sort();
  }

  /** Every tool that has at least one server enabled, sorted. */
  toolsInUse(): string[] {
    return [...new Set(Object.values(this.servers).flatMap((s) => s.tools))].sort();
  }

  /** A map with the servers enabled for the tools (added when missing). */
  enable(servers: string[], tools: string[]): ServerMap {
    const next: ServerMap = { ...this.servers };
    for (const s of servers) next[s] = { tools: [...new Set([...this.toolsOf(s), ...tools])].sort() };
    return next;
  }

  /** A map with the servers turned off for the tools (servers stay added). */
  disable(servers: string[], tools: string[]): ServerMap {
    const next: ServerMap = { ...this.servers };
    for (const s of servers) if (this.has(s)) next[s] = { tools: this.toolsOf(s).filter((t) => !tools.includes(t)) };
    return next;
  }

  /** A map without the servers. */
  remove(servers: string[]): ServerMap {
    const gone = new Set(servers);
    return Object.fromEntries(Object.entries(this.servers).filter(([name]) => !gone.has(name)));
  }
}
