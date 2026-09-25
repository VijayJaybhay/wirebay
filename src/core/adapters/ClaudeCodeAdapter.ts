/**
 * Claude Code needs special handling for its user scope.
 * @module
 */

import { spawnSync } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { ProcessCommand } from "../launch/ProcessCommand.ts";
import type { ExecutableResolver } from "../platform/ExecutableResolver.ts";
import type { WirebayPaths } from "../platform/WirebayPaths.ts";
import type { Changes, ConfigFormat } from "../formats/ConfigFormat.ts";
import { type AdapterDeps, type CommitResult, type Snapshot, type Target, ToolAdapter } from "./ToolAdapter.ts";

/**
 * `~/.claude.json` holds a lot of live Claude Code state and Claude Code rewrites it constantly,
 * so for the user scope this adapter goes through the official CLI
 * (`claude mcp add-json/remove -s user`). Project scope (`.mcp.json`) is a normal file.
 */
export class ClaudeCodeAdapter extends ToolAdapter {
  private readonly resolver: ExecutableResolver;
  private readonly paths: WirebayPaths;

  constructor(format: ConfigFormat, deps: AdapterDeps, resolver: ExecutableResolver, paths: WirebayPaths) {
    super(format, deps);
    this.resolver = resolver;
    this.paths = paths;
  }

  override commit(target: Target, snapshot: Snapshot, changes: Changes, newText: string): CommitResult {
    if (!this.shouldUseCli(target)) return super.commit(target, snapshot, changes, newText);
    const backup = this.deps.backups.backup(target.tool.id, target.file);
    // Removing first makes add-json behave like "replace". A missing entry is fine.
    for (const name of [...changes.remove, ...Object.keys(changes.set)]) this.claude(["mcp", "remove", "-s", "user", name]);
    for (const [name, entry] of Object.entries(changes.set)) {
      const r = this.claude(["mcp", "add-json", "-s", "user", name, JSON.stringify(entry)]);
      if (!r.ok) throw new Error(`claude mcp add-json failed for "${name}": ${r.output}`);
    }
    return { via: "cli", backup };
  }

  /**
   * The CLI always writes the real `~/.claude.json`, so it is only used when that file is the
   * target, never in a sandboxed home.
   */
  private shouldUseCli(target: Target): boolean {
    if (target.scope !== "user" || this.paths.sandboxed) return false;
    if (path.resolve(target.file) !== path.resolve(path.join(os.homedir(), ".claude.json"))) return false;
    return !!this.resolver.resolve("claude");
  }

  private claude(args: string[]): { ok: boolean; output: string } {
    const exe = this.resolver.resolve("claude");
    if (!exe) return { ok: false, output: "claude CLI not found" };
    const cmd = ProcessCommand.forExecutable(exe, args);
    const r = spawnSync(cmd.command, cmd.args, { encoding: "utf8", windowsHide: true, windowsVerbatimArguments: cmd.verbatim });
    return { ok: r.status === 0, output: `${r.stdout ?? ""}${r.stderr ?? ""}`.trim() };
  }
}
