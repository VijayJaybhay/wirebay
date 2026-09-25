/**
 * One AI coding tool (MCP client) described by its `tool.json` manifest.
 * @module
 */

import { existsSync } from "node:fs";
import type { ExecutableResolver } from "../platform/ExecutableResolver.ts";
import type { WirebayPaths } from "../platform/WirebayPaths.ts";
import type { ScopeName, ToolManifest } from "../types.ts";

/**
 * A tool manifest plus behaviour derived from it (config paths, install detection).
 *
 * @example
 * tool.configPath("user", paths);   // "/home/me/.codex/config.toml"
 * tool.isInstalled(resolver, paths); // true
 */
export class Tool {
  /** The raw manifest as stored in `tool.json`. */
  readonly manifest: ToolManifest;

  constructor(manifest: ToolManifest) {
    this.manifest = manifest;
  }

  /** Unique id, e.g. `codex`. */
  get id(): string {
    return this.manifest.id;
  }

  /** Display name. */
  get name(): string {
    return this.manifest.name;
  }

  /** Extra names accepted in commands. */
  get aliases(): string[] {
    return this.manifest.aliases ?? [];
  }

  /** Id plus aliases. */
  get names(): string[] {
    return [this.id, ...this.aliases];
  }

  /** Config file format. */
  get format(): ToolManifest["format"] {
    return this.manifest.format;
  }

  /** Key (dot path) servers live under. */
  get rootKey(): string {
    return this.manifest.rootKey;
  }

  /** True when the tool needs a restart to pick up config changes. */
  get restartRequired(): boolean {
    return this.manifest.restartRequired ?? false;
  }

  /** True when the tool can start Windows `.cmd` shims directly. */
  get supportsCmdShims(): boolean {
    return this.manifest.supports?.cmdShims ?? false;
  }

  /** Scopes this tool has config files for. */
  get scopes(): ScopeName[] {
    return Object.keys(this.manifest.configs) as ScopeName[];
  }

  /** `stable`, `beta` or `deprecated`. */
  get status(): NonNullable<ToolManifest["status"]> {
    return this.manifest.status ?? "beta";
  }

  /**
   * The config file for a scope on this OS.
   * @returns An absolute path, or `undefined` when the tool has no such scope (on this OS).
   */
  configPath(scope: ScopeName, paths: WirebayPaths, cwd?: string): string | undefined {
    const location = this.manifest.configs[scope];
    if (!location) return undefined;
    const raw = paths.pick(location.path);
    return raw ? paths.expand(raw, cwd) : undefined;
  }

  /** A tool counts as installed when one of its commands is found or one of its folders/config files exists. */
  isInstalled(resolver: ExecutableResolver, paths: WirebayPaths): boolean {
    for (const cmd of this.manifest.detect?.commands ?? []) if (resolver.resolve(cmd)) return true;
    for (const p of this.manifest.detect?.paths ?? []) {
      const raw = paths.pick(p);
      if (raw && existsSync(paths.expand(raw))) return true;
    }
    const userFile = this.configPath("user", paths);
    return userFile ? existsSync(userFile) : false;
  }
}
