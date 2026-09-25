/**
 * `wirebay export [tools]`
 * @module
 */

import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { AppContext } from "../app/AppContext.ts";
import type { ParsedCommand } from "../cli/CommandParser.ts";
import { ExitCode } from "../core/errors.ts";
import { ConfigStore } from "../core/store/ConfigStore.ts";
import { Command } from "./Command.ts";
import { TargetSelector } from "./support/TargetSelector.ts";

/** Writes ready-to-copy config files to `./wirebay-export/<tool>/` without touching real configs. */
export class ExportCommand extends Command {
  readonly name = "export";
  override readonly aliases = ["generate"];
  override readonly targeted = true;
  readonly help = { usage: "wirebay export [tools] [--out dir]", summary: "Write ready-to-copy config files without touching real ones.", examples: ["wirebay export", "wirebay export cursor"] };

  async run(input: ParsedCommand, ctx: AppContext): Promise<number> {
    const t = ctx.terminal;
    const config = ctx.config.load();
    const selector = new TargetSelector(ctx, input);
    const scope = selector.scope(config);
    const toolIds = input.tools === "all" ? ctx.tools.all().map((x) => x.id) : input.tools?.length ? input.tools : ConfigStore.toolsInUse(config);
    const onlyServers = selector.servers();
    const outDir = path.resolve(ctx.cwd, String(input.flags.out ?? "wirebay-export"));
    if (!toolIds.length) {
      t.out("Nothing to export. Add a server first: wirebay add github to all");
      return ExitCode.Ok;
    }
    for (const id of toolIds) {
      const tool = ctx.tools.get(id);
      const real = ctx.sync.targetFor(tool, scope);
      if (!real) continue;
      const names = ConfigStore.serversForTool(config, tool.id).filter((s) => !onlyServers || onlyServers.includes(s));
      const file = path.join(outDir, tool.id, path.basename(real.file));
      const empty = { text: "", exists: false, entries: {}, locked: new Set<string>() };
      const text = ctx.adapters.for(tool).render({ ...real, file }, empty, { set: ctx.sync.desiredEntries(config, tool, scope, names), remove: [] });
      mkdirSync(path.dirname(file), { recursive: true });
      writeFileSync(file, text);
      t.out(`${t.ok("✓")} ${tool.name}: ${file} ${t.dim(`→ merge into ${real.file}`)}`);
    }
    t.out(t.dim("These files contain no secrets: every entry calls `wirebay run <server>`."));
    return ExitCode.Ok;
  }
}
