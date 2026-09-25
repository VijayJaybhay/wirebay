#!/usr/bin/env node
// wirebay CLI entry: parse the command line, run the command, exit with its code.

import { canonical, parse } from "./cli/parse.ts";
import { c, note } from "./cli/ui.ts";
import { add } from "./commands/add.ts";
import { vocabulary } from "./commands/context.ts";
import { presetsCommand, toolsCommand } from "./commands/directory.ts";
import { doctor } from "./commands/doctor.ts";
import { disable, enable, remove } from "./commands/enable.ts";
import { exportCommand } from "./commands/export.ts";
import { help, version } from "./commands/help.ts";
import { init } from "./commands/init.ts";
import { list } from "./commands/list.ts";
import { restore } from "./commands/restore.ts";
import { secretsCommand } from "./commands/secrets.ts";
import { sync, unsync } from "./commands/sync.ts";
import { WirebayError } from "./core/errors.ts";
import { runServer } from "./core/launcher.ts";

async function main(argv: string[]): Promise<number> {
  // `run` is on the hot path of every tool and must never write to stdout: handle it first.
  if (argv[0] === "run") {
    const name = argv[1];
    if (!name) {
      process.stderr.write("[wirebay] usage: wirebay run <server>\n");
      return 2;
    }
    return runServer(name);
  }

  const cmd = parse(argv, vocabulary());
  const quietVerbs = new Set(["help", "version", "run"]);
  if (!quietVerbs.has(cmd.verb) && !cmd.flags.json) note(c.dim(canonical(cmd)));

  switch (cmd.verb) {
    case "help":
      return help(cmd.rest[0]);
    case "version":
      process.stdout.write(version() + "\n");
      return 0;
    case "init":
      return init(cmd);
    case "add":
      return add(cmd);
    case "sync":
      return sync(cmd);
    case "unsync":
      return unsync(cmd);
    case "export":
      return exportCommand(cmd);
    case "enable":
      return enable(cmd);
    case "disable":
      return disable(cmd);
    case "remove":
      return remove(cmd);
    case "list":
      return list(cmd);
    case "tools":
      return toolsCommand(cmd);
    case "presets":
      return presetsCommand(cmd);
    case "secrets":
      return secretsCommand(cmd);
    case "doctor":
      return doctor(cmd);
    case "restore":
      return restore(cmd);
    default:
      return help();
  }
}

main(process.argv.slice(2)).then(
  (code) => {
    process.exitCode = code;
  },
  (err: unknown) => {
    if (err instanceof WirebayError) {
      process.stderr.write(`${c.err("error:")} ${err.message}\n`);
      if (err.hint) process.stderr.write(`${c.cyan("hint:")} ${err.hint.replace(/\n/g, "\n      ")}\n`);
      process.exitCode = err.exitCode;
    } else {
      process.stderr.write(`${c.err("unexpected error:")} ${(err as Error)?.stack ?? String(err)}\n`);
      process.stderr.write("Please report it: https://github.com/VijayJaybhay/wirebay/issues\n");
      process.exitCode = 1;
    }
  },
);
