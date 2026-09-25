// Config formats must never disturb anything wirebay did not write.

import assert from "node:assert/strict";
import { test } from "node:test";
import { splitRootKey } from "../../src/core/formats/ConfigFormat.ts";
import { JsonConfigFormat } from "../../src/core/formats/JsonConfigFormat.ts";
import { TomlConfigFormat } from "../../src/core/formats/TomlConfigFormat.ts";
import { YamlConfigFormat } from "../../src/core/formats/YamlConfigFormat.ts";

const json = new JsonConfigFormat();
const toml = new TomlConfigFormat();
const yaml = new YamlConfigFormat();
const set = (entries: Record<string, Record<string, unknown>>) => ({ set: entries, remove: [] });
const remove = (...names: string[]) => ({ set: {}, remove: names });

const JSONC = `{
  // my servers
  "theme": "dark",
  "mcpServers": {
    "mine": { "command": "bar" } // keep me compact
  }
}
`;

test("root keys split on dots, and \\. is a literal dot", () => {
  assert.deepEqual(splitRootKey("mcp.servers"), ["mcp", "servers"]);
  assert.deepEqual(splitRootKey("amp\\.mcpServers"), ["amp.mcpServers"]);
});

test("json: add then remove round-trips byte for byte", () => {
  const added = json.write(JSONC, "mcpServers", set({ w: { command: "node", args: ["x"] } }), "f");
  assert.ok(added.includes(`"mine": { "command": "bar" }, // keep me compact\n`), "neighbour and its comment untouched");
  assert.deepEqual(json.read(added, "mcpServers", "f").entries.w, { command: "node", args: ["x"] });
  assert.equal(json.write(added, "mcpServers", remove("w"), "f"), JSONC);
});

test("json: replace an existing entry", () => {
  const a = json.write(JSONC, "mcpServers", set({ w: { command: "a" } }), "f");
  const b = json.write(a, "mcpServers", set({ w: { command: "b" } }), "f");
  assert.equal(json.read(b, "mcpServers", "f").entries.w?.command, "b");
  assert.ok(b.includes("// my servers"));
});

test("json: creates the file, nested keys, and flat dotted keys", () => {
  assert.deepEqual(JSON.parse(json.write("", "mcpServers", set({ a: { command: "x" } }), "f")), { mcpServers: { a: { command: "x" } } });
  assert.deepEqual(JSON.parse(json.write('{\n  "x": 1\n}\n', "mcp.servers", set({ a: { command: "x" } }), "f")), { x: 1, mcp: { servers: { a: { command: "x" } } } });
  assert.deepEqual(JSON.parse(json.write("", "amp\\.mcpServers", set({ a: { command: "x" } }), "f")), { "amp.mcpServers": { a: { command: "x" } } });
});

test("json: removing the middle, first, last and only entries", () => {
  const three = '{\n  "s": {\n    "a": 1,\n    "b": 2,\n    "c": 3\n  }\n}\n';
  assert.deepEqual(JSON.parse(json.write(three, "s", remove("b"), "f")), { s: { a: 1, c: 3 } });
  assert.deepEqual(JSON.parse(json.write(three, "s", remove("a"), "f")), { s: { b: 2, c: 3 } });
  assert.deepEqual(JSON.parse(json.write(three, "s", remove("c"), "f")), { s: { a: 1, b: 2 } });
  assert.deepEqual(JSON.parse(json.write('{"s":{"a":1}}', "s", remove("a"), "f")), { s: {} });
});

test("json: keeps CRLF and tab indentation", () => {
  const crlf = '{\r\n\t"mcpServers": {\r\n\t\t"a": {}\r\n\t}\r\n}\r\n';
  const out = json.write(crlf, "mcpServers", set({ b: { command: "x" } }), "f");
  assert.ok(!/[^\r]\n/.test(out), "only CRLF line endings");
  assert.ok(out.includes('\t\t"b": {'));
});

const TOML = `# my codex config
model = "gpt-5"

[mcp_servers.mine]
command = "foo"
`;

test("toml: managed block leaves the rest byte for byte and removes cleanly", () => {
  const added = toml.write(TOML, "mcp_servers", set({ w: { command: "node", args: ["x", "run", "w"] } }), "f");
  assert.ok(added.startsWith(TOML));
  assert.ok(added.includes(TomlConfigFormat.blockStart));
  const { entries, locked } = toml.read(added, "mcp_servers", "f");
  assert.deepEqual(Object.keys(entries).sort(), ["mine", "w"]);
  assert.deepEqual([...locked], ["mine"]);
  assert.equal(toml.write(added, "mcp_servers", remove("w"), "f"), TOML);
});

test("toml: rewriting the block keeps text after it", () => {
  const withBlock = toml.write(TOML, "mcp_servers", set({ a: { command: "x" } }), "f") + '\n[profile]\nname = "p"\n';
  const updated = toml.write(withBlock, "mcp_servers", set({ a: { command: "y" } }), "f");
  assert.ok(updated.endsWith('[profile]\nname = "p"\n'));
  assert.equal(toml.read(updated, "mcp_servers", "f").entries.a?.command, "y");
});

test("yaml: edits keep comments; new files are block style", () => {
  const y = "# top\nmcpServers:\n  mine:\n    command: bar # inline\n";
  const out = yaml.write(y, "mcpServers", set({ w: { command: "x" } }), "f");
  assert.ok(out.includes("# top") && out.includes("# inline"));
  assert.deepEqual(Object.keys(yaml.read(out, "mcpServers", "f").entries), ["mine", "w"]);
  assert.deepEqual(Object.keys(yaml.read(yaml.write(out, "mcpServers", remove("w"), "f"), "mcpServers", "f").entries), ["mine"]);
  assert.ok(!yaml.write("", "extensions", set({ a: { cmd: "x" } }), "f").includes("{"), "block style, not flow style");
});
