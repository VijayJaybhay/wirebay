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
      $schema: "https://raw.githubusercontent.com/pragnalabs-ai/wirebay/main/schemas/config.schema.json",
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
    const found = this.writer.readJson(this.paths.configFile) as Partial<WirebayConfig> | undefined;
    return { ...ConfigStore.defaults(), ...found, servers: { ...(found?.servers ?? {}) }, paths: { ...(found?.paths ?? {}) } };
  }

  /** Write the config atomically. */
  save(config: WirebayConfig): void {
    this.writer.writeJson(this.paths.configFile, config);
  }
}
