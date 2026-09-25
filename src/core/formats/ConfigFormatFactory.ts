/**
 * Picks the {@link ConfigFormat} strategy for a tool's `format`.
 * @module
 */

import type { ToolManifest } from "../types.ts";
import type { ConfigFormat } from "./ConfigFormat.ts";
import { JsonConfigFormat } from "./JsonConfigFormat.ts";
import { TomlConfigFormat } from "./TomlConfigFormat.ts";
import { YamlConfigFormat } from "./YamlConfigFormat.ts";

/** Factory for config format strategies. Formats are stateless, so each is created once per factory. */
export class ConfigFormatFactory {
  private readonly formats: Record<ToolManifest["format"], ConfigFormat>;

  constructor() {
    const json = new JsonConfigFormat();
    this.formats = { json, jsonc: json, toml: new TomlConfigFormat(), yaml: new YamlConfigFormat() };
  }

  /** The strategy for a manifest format. */
  for(format: ToolManifest["format"]): ConfigFormat {
    return this.formats[format];
  }
}
