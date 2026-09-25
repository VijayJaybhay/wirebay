/**
 * `~/.wirebay/config.json`: the desired state (which servers go to which tools).
 * @module
 */

import type { SafeFileWriter } from "../io/SafeFileWriter.ts";
import type { WirebayPaths } from "../platform/WirebayPaths.ts";
import type { WirebayConfig } from "../types.ts";

/** Loads and saves the user's desired state. */
export class ConfigStore {
  /** Current config file format version. */
  static readonly version = 1;

  private readonly paths: WirebayPaths;
  private readonly writer: SafeFileWriter;

  constructor(paths: WirebayPaths, writer: SafeFileWriter) {
    this.paths = paths;
    this.writer = writer;
  }

  /** A config with nothing enabled. */
  static defaults(): WirebayConfig {
    return {
      $schema: "https://raw.githubusercontent.com/VijayJaybhay/wirebay/main/schemas/config.schema.json",
      version: ConfigStore.version,
      defaultTools: [],
      defaultScope: "user",
      renderMode: "auto",
      paths: {},
      servers: {},
    };
  }

  /** Read the config, filling in defaults for anything missing. */
  load(): WirebayConfig {
    const found = this.writer.readJson<Partial<WirebayConfig>>(this.paths.configFile);
    return { ...ConfigStore.defaults(), ...found, servers: { ...(found?.servers ?? {}) }, paths: { ...(found?.paths ?? {}) } };
  }

  /** Write the config atomically. */
  save(config: WirebayConfig): void {
    this.writer.writeJson(this.paths.configFile, config);
  }

  /** Server names enabled for a tool, sorted. */
  static serversForTool(config: WirebayConfig, toolId: string): string[] {
    return Object.entries(config.servers)
      .filter(([, s]) => s.tools.includes(toolId))
      .map(([name]) => name)
      .sort();
  }

  /** Every tool that has at least one server enabled, sorted. */
  static toolsInUse(config: WirebayConfig): string[] {
    return [...new Set(Object.values(config.servers).flatMap((s) => s.tools))].sort();
  }

  /** Enable servers for tools (merging with what is already enabled). */
  static enable(config: WirebayConfig, servers: string[], tools: string[]): void {
    for (const s of servers) {
      const prev = config.servers[s]?.tools ?? [];
      config.servers[s] = { tools: [...new Set([...prev, ...tools])].sort() };
    }
  }

  /** Disable servers for tools (servers stay added, possibly with no tools). */
  static disable(config: WirebayConfig, servers: string[], tools: string[]): void {
    for (const s of servers) {
      const entry = config.servers[s];
      if (entry) config.servers[s] = { tools: entry.tools.filter((t) => !tools.includes(t)) };
    }
  }
}
