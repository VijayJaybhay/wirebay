/**
 * Picks the {@link ConfigFormat} strategy for a tool's `format`.
 * @module
 */

import type { ToolManifest } from "../types.ts";
import type { ConfigFormat } from "./ConfigFormat.ts";
import { JsonConfigFormat } from "./JsonConfigFormat.ts";
import { TomlConfigFormat } from "./TomlConfigFormat.ts";
import { YamlConfigFormat } from "./YamlConfigFormat.ts";

/** Factory for config format strategies. Formats are stateless, so instances are shared. */
export class ConfigFormatFactory {
  private static readonly formats: Record<ToolManifest["format"], ConfigFormat> = {
    json: new JsonConfigFormat(),
    jsonc: new JsonConfigFormat(),
    toml: new TomlConfigFormat(),
    yaml: new YamlConfigFormat(),
  };

  /** The strategy for a manifest format. */
  static for(format: ToolManifest["format"]): ConfigFormat {
    return ConfigFormatFactory.formats[format];
  }
}
