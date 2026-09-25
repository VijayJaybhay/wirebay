/**
 * Creates the right {@link ToolAdapter} for each tool.
 * @module
 */

import { ConfigFormatFactory } from "../formats/ConfigFormatFactory.ts";
import type { ExecutableResolver } from "../platform/ExecutableResolver.ts";
import type { WirebayPaths } from "../platform/WirebayPaths.ts";
import type { Tool } from "../tools/Tool.ts";
import { ClaudeCodeAdapter } from "./ClaudeCodeAdapter.ts";
import { FileToolAdapter } from "./FileToolAdapter.ts";
import type { AdapterDeps, ToolAdapter } from "./ToolAdapter.ts";

/** Builds an adapter for a tool from the services it needs. */
type AdapterBuilder = (tool: Tool, factory: AdapterFactory) => ToolAdapter;

/**
 * Factory for tool adapters. Tools use {@link FileToolAdapter} unless their manifest names an
 * override (`"adapter": "claude-code"`) registered here.
 */
export class AdapterFactory {
  /** Code overrides, keyed by the manifest's `adapter` value. */
  private static readonly overrides: Record<string, AdapterBuilder> = {
    "claude-code": (tool, f) => new ClaudeCodeAdapter(f.formats.for(tool.format), f.deps, f.resolver, f.paths),
  };

  readonly deps: AdapterDeps;
  readonly resolver: ExecutableResolver;
  readonly paths: WirebayPaths;
  /** Config format strategies. */
  readonly formats = new ConfigFormatFactory();
  private readonly cache = new Map<string, ToolAdapter>();

  constructor(deps: AdapterDeps, resolver: ExecutableResolver, paths: WirebayPaths) {
    this.deps = deps;
    this.resolver = resolver;
    this.paths = paths;
  }

  /** The adapter for a tool (cached per tool id). */
  for(tool: Tool): ToolAdapter {
    let adapter = this.cache.get(tool.id);
    if (!adapter) {
      const override = tool.manifest.adapter ? AdapterFactory.overrides[tool.manifest.adapter] : undefined;
      adapter = override ? override(tool, this) : new FileToolAdapter(this.formats.for(tool.format), this.deps);
      this.cache.set(tool.id, adapter);
    }
    return adapter;
  }
}
