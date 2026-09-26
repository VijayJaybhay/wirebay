// EntryRenderer: the launcher command each render mode writes into tool configs.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { EntryRenderer } from "../../src/core/sync/EntryRenderer.ts";
import { repoRoot, withSandbox } from "../helpers.ts";

const packageName = (JSON.parse(readFileSync(path.join(repoRoot, "package.json"), "utf8")) as { name: string }).name;

await test("npx mode runs the published package by its npm name", () =>
  withSandbox((sb) => {
    const cursor = sb.context().tools.get("cursor");
    const renderer = new EntryRenderer({ mode: "npx", nodePath: "/usr/bin/node", cliPath: "/x/cli.js", os: "linux" });
    const { command, args } = renderer.launcherCommand("github", cursor);
    assert.equal(command, "npx");
    assert.deepEqual(args, ["-y", `${packageName}@latest`, "run", "github"]);
  }));

await test("portable and absolute modes call the wirebay command and script", () =>
  withSandbox((sb) => {
    const cursor = sb.context().tools.get("cursor");
    const portable = new EntryRenderer({ mode: "portable", nodePath: "/usr/bin/node", cliPath: "/x/cli.js", os: "linux" });
    assert.deepEqual(portable.launcherCommand("github", cursor), { command: "wirebay", args: ["run", "github"], env: {} });
    const absolute = new EntryRenderer({ mode: "absolute", nodePath: "/usr/bin/node", cliPath: "/x/cli.js", os: "linux" });
    assert.deepEqual(absolute.launcherCommand("github", cursor), {
      command: "/usr/bin/node",
      args: ["/x/cli.js", "run", "github"],
      env: {},
    });
  }));
