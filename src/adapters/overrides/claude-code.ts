// Claude Code override. ~/.claude.json holds a lot of live Claude Code state and is written
// by Claude Code constantly, so for the user scope wirebay goes through the official CLI
// (`claude mcp add-json/remove -s user`). Project scope (.mcp.json) is a normal file.

import { spawnSync } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { backupFile } from "../../core/io.ts";
import { toSpawnable } from "../../core/launcher.ts";
import { resolveExecutable } from "../../core/paths.ts";
import { commitFile, readSnapshot, renderText } from "../generic.ts";
import type { Adapter } from "../types.ts";

function claude(args: string[]): { ok: boolean; output: string } {
  const exe = resolveExecutable("claude");
  if (!exe) return { ok: false, output: "claude CLI not found" };
  const s = toSpawnable(exe, args);
  const r = spawnSync(s.command, s.args, { encoding: "utf8", windowsHide: true, windowsVerbatimArguments: s.verbatim ?? false });
  return { ok: r.status === 0, output: `${r.stdout ?? ""}${r.stderr ?? ""}`.trim() };
}

export const claudeCodeAdapter: Adapter = {
  read: (target) => readSnapshot(target),
  render: (target, snapshot, changes) => renderText(target, snapshot, changes),
  commit(target, snapshot, changes, newText) {
    // The CLI always writes the real ~/.claude.json, so only use it when that is the target
    // (never in a sandboxed home such as tests or WIREBAY_USER_HOME).
    const realFile = path.join(os.homedir(), ".claude.json");
    const usesRealFile = !process.env.WIREBAY_USER_HOME && path.resolve(target.file) === path.resolve(realFile);
    if (target.scope !== "user" || !usesRealFile || !resolveExecutable("claude")) return commitFile(target, snapshot, newText);
    const backup = backupFile(target.tool.id, target.file);
    // Removing first makes add-json behave like "replace". A missing entry is fine.
    for (const name of [...changes.remove, ...Object.keys(changes.set)]) {
      claude(["mcp", "remove", "-s", "user", name]);
    }
    for (const [name, entry] of Object.entries(changes.set)) {
      const r = claude(["mcp", "add-json", "-s", "user", name, JSON.stringify(entry)]);
      if (!r.ok) throw new Error(`claude mcp add-json failed for "${name}": ${r.output}`);
    }
    return { via: "cli", backup };
  },
};
