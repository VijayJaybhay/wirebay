// `wirebay export [tools]`: write ready-to-copy config files to ./wirebay-export/<tool>/
// without touching any real tool config.

import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { ParsedCommand } from "../cli/parse.ts";
import { c, out } from "../cli/ui.ts";
import { adapterFor } from "../adapters/index.ts";
import { desiredEntries, serversForTool, targetFor, toolsInConfig } from "../core/sync.ts";
import { loadConfig } from "../core/store.ts";
import { getTool, loadTools } from "../core/tools.ts";
import { scopeOf, serverList } from "./context.ts";

export async function exportCommand(cmd: ParsedCommand): Promise<number> {
  const config = loadConfig();
  const tools = loadTools();
  const scope = scopeOf(cmd, config);
  const toolIds = cmd.tools === "all" ? tools.map((t) => t.id) : cmd.tools?.length ? cmd.tools : toolsInConfig(config);
  const onlyServers = serverList(cmd.servers, config);
  const outDir = path.resolve(String(cmd.flags.out ?? "wirebay-export"));

  if (!toolIds.length) {
    out("Nothing to export. Add a server first: wirebay add github to all");
    return 0;
  }
  for (const id of toolIds) {
    const tool = getTool(id, tools);
    const real = targetFor(tool, scope);
    if (!real) continue;
    const names = serversForTool(config, tool.id).filter((s) => !onlyServers || onlyServers.includes(s));
    const file = path.join(outDir, tool.id, path.basename(real.file));
    const target = { ...real, file };
    const adapter = adapterFor(tool);
    const empty = { text: "", exists: false, entries: {}, locked: new Set<string>() };
    const text = adapter.render(target, empty, { set: desiredEntries(config, tool, scope, names), remove: [] });
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, text);
    out(`${c.ok("✓")} ${tool.name}: ${file} ${c.dim(`→ merge into ${real.file}`)}`);
  }
  out(c.dim("These files contain no secrets: every entry calls `wirebay run <server>`."));
  return 0;
}
