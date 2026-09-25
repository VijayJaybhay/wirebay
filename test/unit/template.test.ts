import assert from "node:assert/strict";
import { test } from "node:test";
import { TemplateExpander } from "../../src/core/template/TemplateExpander.ts";

test("expand replaces variables and defaults", () => {
  assert.equal(TemplateExpander.expand("a ${X} b", { X: "1" }), "a 1 b");
  assert.equal(TemplateExpander.expand("${MISSING}", {}), "");
  assert.equal(TemplateExpander.expand("${EMPTY:-fallback}", { EMPTY: "" }), "fallback");
  assert.equal(TemplateExpander.expand("${SET:-fallback}", { SET: "v" }), "v");
});

test("optional arg groups are dropped when a variable is empty", () => {
  const args = ["mcp", { optional: ["--dir", "${DIR}"] }, "--x"];
  assert.deepEqual(TemplateExpander.expandArgs(args, {}), ["mcp", "--x"]);
  assert.deepEqual(TemplateExpander.expandArgs(args, { DIR: "/p" }), ["mcp", "--dir", "/p", "--x"]);
});

test("variables are discovered in strings and args", () => {
  assert.deepEqual(TemplateExpander.variablesIn("${A} and ${B:-x}"), ["A", "B"]);
  assert.deepEqual(TemplateExpander.variablesInArgs(["${A}", { optional: ["--d", "${D}"] }]), ["A", "D"]);
});
