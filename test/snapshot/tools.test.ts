// Every tool in tools/ is checked automatically: its manifest is valid and it renders
// exactly like its examples/. Adding a tool adds these tests without writing any code.

import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { exampleFileName, renderExample } from "../../src/core/directory.ts";
import { loadTools } from "../../src/core/tools.ts";
import type { ScopeName } from "../../src/core/types.ts";
import { repoRoot, sandbox } from "../helpers.ts";

const sb = sandbox(); // no user overrides
const tools = loadTools();
sb.cleanup();

for (const tool of tools) {
  for (const scope of Object.keys(tool.configs) as ScopeName[]) {
    test(`${tool.id} (${scope}) renders like examples/${exampleFileName(tool, scope)}`, () => {
      const file = path.join(repoRoot, "tools", tool.id, "examples", exampleFileName(tool, scope));
      assert.ok(existsSync(file), `missing ${file}; run npm run gen:docs`);
      assert.equal(renderExample(tool, scope), readFileSync(file, "utf8").replace(/\r\n/g, "\n"));
    });
  }
  test(`${tool.id} has a GUIDE.md`, () => {
    assert.ok(existsSync(path.join(repoRoot, "tools", tool.id, "GUIDE.md")));
  });
}
