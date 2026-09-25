// Merging must never disturb anything wirebay did not write.

import assert from "node:assert/strict";
import { test } from "node:test";
import { editJson, readJsonEntries } from "../../src/merge/json.ts";
import { BLOCK_START, readTomlEntries, writeTomlBlock } from "../../src/merge/toml.ts";
import { editYaml, readYamlEntries } from "../../src/merge/yaml.ts";

const JSONC = `{
  // my servers
  "theme": "dark",
  "mcpServers": {
    "mine": { "command": "bar" } // keep me compact
  }
}
`;

test("json: add then remove round-trips byte for byte", () => {
  const added = editJson(JSONC, "mcpServers", { w: { command: "node", args: ["x"] } }, []);
  assert.ok(added.includes(`"mine": { "command": "bar" }, // keep me compact\n`), "neighbour and its comment untouched");
  assert.deepEqual(readJsonEntries(added, "mcpServers").w, { command: "node", args: ["x"] });
  assert.equal(editJson(added, "mcpServers", {}, ["w"]), JSONC);
});

test("json: replace an existing managed entry", () => {
  const a = editJson(JSONC, "mcpServers", { w: { command: "a" } }, []);
  const b = editJson(a, "mcpServers", { w: { command: "b" } }, []);
  assert.equal(readJsonEntries(b, "mcpServers").w?.command, "b");
  assert.ok(b.includes("// my servers"));
});

test("json: creates the file and nested root keys", () => {
  assert.deepEqual(JSON.parse(editJson("", "mcpServers", { a: { command: "x" } }, [])), { mcpServers: { a: { command: "x" } } });
  const nested = editJson('{\n  "x": 1\n}\n', "mcp.servers", { a: { command: "x" } }, []);
  assert.deepEqual(JSON.parse(nested), { x: 1, mcp: { servers: { a: { command: "x" } } } });
});

test("json: removing the middle, first and only entries", () => {
  const three = '{\n  "s": {\n    "a": 1,\n    "b": 2,\n    "c": 3\n  }\n}\n';
  assert.deepEqual(JSON.parse(editJson(three, "s", {}, ["b"])), { s: { a: 1, c: 3 } });
  assert.deepEqual(JSON.parse(editJson(three, "s", {}, ["a"])), { s: { b: 2, c: 3 } });
  assert.deepEqual(JSON.parse(editJson(three, "s", {}, ["c"])), { s: { a: 1, b: 2 } });
  assert.deepEqual(JSON.parse(editJson('{"s":{"a":1}}', "s", {}, ["a"])), { s: {} });
});

test("json: keeps CRLF and tab indentation", () => {
  const crlf = '{\r\n\t"mcpServers": {\r\n\t\t"a": {}\r\n\t}\r\n}\r\n';
  const out = editJson(crlf, "mcpServers", { b: { command: "x" } }, []);
  assert.ok(!/[^\r]\n/.test(out), "only CRLF line endings");
  assert.ok(out.includes('\t\t"b": {'));
});

const TOML = `# my codex config
model = "gpt-5"

[mcp_servers.mine]
command = "foo"
`;

test("toml: managed block leaves the rest byte for byte and removes cleanly", () => {
  const added = writeTomlBlock(TOML, "mcp_servers", { w: { command: "node", args: ["x", "run", "w"] } });
  assert.ok(added.startsWith(TOML));
  assert.ok(added.includes(BLOCK_START));
  const { managed, outside } = readTomlEntries(added, "mcp_servers");
  assert.deepEqual(Object.keys(managed), ["w"]);
  assert.deepEqual(Object.keys(outside), ["mine"]);
  assert.equal(writeTomlBlock(added, "mcp_servers", {}), TOML);
});

test("toml: rewriting the block keeps text after it", () => {
  const withBlock = writeTomlBlock(TOML, "mcp_servers", { a: { command: "x" } }) + "\n[profile]\nname = \"p\"\n";
  const updated = writeTomlBlock(withBlock, "mcp_servers", { a: { command: "y" } });
  assert.ok(updated.endsWith('[profile]\nname = "p"\n'));
  assert.equal(readTomlEntries(updated, "mcp_servers").managed.a?.command, "y");
});

test("yaml: edits keep comments", () => {
  const y = "# top\nmcpServers:\n  mine:\n    command: bar # inline\n";
  const out = editYaml(y, "mcpServers", { w: { command: "x" } }, []);
  assert.ok(out.includes("# top") && out.includes("# inline"));
  assert.deepEqual(Object.keys(readYamlEntries(out, "mcpServers")), ["mine", "w"]);
  assert.deepEqual(Object.keys(readYamlEntries(editYaml(out, "mcpServers", {}, ["w"]), "mcpServers")), ["mine"]);
});
