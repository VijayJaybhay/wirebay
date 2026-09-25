// The generic adapter: reads and writes any tool purely from its tool.json
// (format, rootKey, merge strategy). New tools normally need no code at all.

import { existsSync } from "node:fs";
import { backupFile, mtimeOf, readTextIfExists, writeFileAtomic } from "../core/io.ts";
import type { Entry } from "../core/types.ts";
import { editJson, readJsonEntries } from "../merge/json.ts";
import { readTomlEntries, writeTomlBlock } from "../merge/toml.ts";
import { editYaml, readYamlEntries } from "../merge/yaml.ts";
import type { Adapter, Changes, Snapshot, Target } from "./types.ts";

export function readSnapshot(target: Target, text = readTextIfExists(target.file)): Snapshot {
  const { tool, file } = target;
  const exists = text !== undefined;
  const body = text ?? "";
  if (tool.format === "toml") {
    const { managed, outside } = readTomlEntries(body, tool.rootKey, file);
    return { text: body, exists, mtime: mtimeOf(file), entries: { ...outside, ...managed }, locked: new Set(Object.keys(outside)) };
  }
  const entries = tool.format === "yaml" ? readYamlEntries(body, tool.rootKey, file) : readJsonEntries(body, tool.rootKey, file);
  return { text: body, exists, mtime: mtimeOf(file), entries, locked: new Set() };
}

export function renderText(target: Target, snapshot: Snapshot, changes: Changes): string {
  const { tool, file } = target;
  if (tool.format === "toml") {
    const { managed } = readTomlEntries(snapshot.text, tool.rootKey, file);
    const next: Record<string, Entry> = { ...managed };
    for (const name of changes.remove) delete next[name];
    Object.assign(next, changes.set);
    return writeTomlBlock(snapshot.text, tool.rootKey, next);
  }
  if (tool.format === "yaml") return editYaml(snapshot.text, tool.rootKey, changes.set, changes.remove, file);
  return editJson(snapshot.text, tool.rootKey, changes.set, changes.remove, file);
}

export function commitFile(target: Target, snapshot: Snapshot, newText: string): { via: "file"; backup?: string } {
  const backup = existsSync(target.file) ? backupFile(target.tool.id, target.file) : undefined;
  writeFileAtomic(target.file, newText, { expectedMtime: snapshot.mtime });
  return { via: "file", backup };
}

export const genericAdapter: Adapter = {
  read: (target) => readSnapshot(target),
  render: (target, snapshot, changes) => renderText(target, snapshot, changes),
  commit: (target, snapshot, _changes, newText) => commitFile(target, snapshot, newText),
};
