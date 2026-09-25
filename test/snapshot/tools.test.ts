// Every tool in tools/ is checked automatically: it renders exactly like its examples/ and has a
// guide. Adding a tool adds these tests without writing any code.

import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { AppContext } from "../../src/app/AppContext.ts";
import { ToolDirectory } from "../../src/core/directory/ToolDirectory.ts";
import { repoRoot } from "../helpers.ts";

const ctx = new AppContext({ env: { ...process.env, WIREBAY_HOME: path.join(repoRoot, ".no-user-home") } });
const directory = new ToolDirectory(ctx.adapters);

for (const tool of ctx.tools.all()) {
  for (const scope of tool.scopes) {
    const name = ToolDirectory.exampleFileName(tool, scope);
    await test(`${tool.id} (${scope}) renders like examples/${name}`, () => {
      const file = path.join(repoRoot, "tools", tool.id, "examples", name);
      assert.ok(existsSync(file), `missing ${file}; run npm run gen:docs`);
      assert.equal(directory.renderExample(tool, scope), readFileSync(file, "utf8").replace(/\r\n/g, "\n"));
    });
  }
  await test(`${tool.id} has a GUIDE.md`, () => {
    assert.ok(existsSync(path.join(repoRoot, "tools", tool.id, "GUIDE.md")));
  });
}

await test("every preset loads and validates", () => {
  const presets = ctx.servers.presets();
  assert.ok(presets.size >= 50);
  for (const def of presets.values()) assert.ok(def.description, `${def.name} has a description`);
});
