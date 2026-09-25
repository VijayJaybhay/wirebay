import assert from "node:assert/strict";
import { test } from "node:test";
import { expand, expandArgs, varsIn, varsInArgs } from "../../src/core/template.ts";

test("expand replaces variables and defaults", () => {
  assert.equal(expand("a ${X} b", { X: "1" }), "a 1 b");
  assert.equal(expand("${MISSING}", {}), "");
  assert.equal(expand("${EMPTY:-fallback}", { EMPTY: "" }), "fallback");
  assert.equal(expand("${SET:-fallback}", { SET: "v" }), "v");
});

test("optional arg groups are dropped when a variable is empty", () => {
  const args = ["mcp", { optional: ["--dir", "${DIR}"] }, "--x"];
  assert.deepEqual(expandArgs(args, {}), ["mcp", "--x"]);
  assert.deepEqual(expandArgs(args, { DIR: "/p" }), ["mcp", "--dir", "/p", "--x"]);
});

test("variables are discovered in strings and args", () => {
  assert.deepEqual(varsIn("${A} and ${B:-x}"), ["A", "B"]);
  assert.deepEqual(varsInArgs(["${A}", { optional: ["--d", "${D}"] }]), ["A", "D"]);
});
