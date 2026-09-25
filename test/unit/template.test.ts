import assert from "node:assert/strict";
import { test } from "node:test";
import { TemplateExpander } from "../../src/core/template/TemplateExpander.ts";

const templates = new TemplateExpander();

await test("expand replaces variables and defaults", () => {
  assert.equal(templates.expand("a ${X} b", { X: "1" }), "a 1 b");
  assert.equal(templates.expand("${MISSING}", {}), "");
  assert.equal(templates.expand("${EMPTY:-fallback}", { EMPTY: "" }), "fallback");
  assert.equal(templates.expand("${SET:-fallback}", { SET: "v" }), "v");
});

await test("optional arg groups are dropped when a variable is empty", () => {
  const args = ["mcp", { optional: ["--dir", "${DIR}"] }, "--x"];
  assert.deepEqual(templates.expandArgs(args, {}), ["mcp", "--x"]);
  assert.deepEqual(templates.expandArgs(args, { DIR: "/p" }), ["mcp", "--dir", "/p", "--x"]);
});

await test("variables are discovered in strings and args", () => {
  assert.deepEqual(templates.variablesIn("${A} and ${B:-x}"), ["A", "B"]);
  assert.deepEqual(templates.variablesInArgs(["${A}", { optional: ["--d", "${D}"] }]), ["A", "D"]);
});
