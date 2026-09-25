// End to end: the real CLI against a fake home, fake tool files and a fake MCP server.
// No network, and never the real ~/.wirebay or real tool configs.

import assert from "node:assert/strict";
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { fakeServer, runCli, sandbox, type Sandbox } from "../helpers.ts";

const SENTINEL = "sentinel_secret_value_4f9a2c";

function setupTools(sb: Sandbox) {
  const cursor = path.join(sb.home, ".cursor", "mcp.json");
  const codex = path.join(sb.home, ".codex", "config.toml");
  mkdirSync(path.dirname(cursor), { recursive: true });
  mkdirSync(path.dirname(codex), { recursive: true });
  writeFileSync(cursor, '{\n  // mine\n  "mcpServers": {\n    "mine": { "command": "bar" }\n  }\n}\n');
  writeFileSync(codex, '# my config\nmodel = "x"\n');
  return { cursor, codex };
}

function allFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true, recursive: true })
    .filter((d) => d.isFile())
    .map((d) => path.join(d.parentPath, d.name));
}

test("init → add → list → doctor → remove → unsync", () => {
  const sb = sandbox();
  try {
    const { cursor, codex } = setupTools(sb);
    let r = runCli(sb, ["init"]);
    assert.equal(r.code, 0, r.stderr);

    r = runCli(sb, ["add", "fake", "--command", process.execPath, "--arg", "--no-warnings", "--arg", fakeServer, "--secret", "TEST_TOKEN", "to", "cursor", "codex"]);
    assert.equal(r.code, 0, r.stderr + r.stdout);
    assert.match(r.stderr, /needs TEST_TOKEN/);

    r = runCli(sb, ["secrets", "set", "TEST_TOKEN", "--stdin"], SENTINEL);
    assert.equal(r.code, 0, r.stderr);
    assert.ok(!r.stdout.includes(SENTINEL), "secret echoed");
    writeFileSync(path.join(sb.wirebayHome, "secrets.env"), `TEST_UNDECLARED=nope\n`, { flag: "a" });

    const cursorJson = readFileSync(cursor, "utf8");
    assert.ok(cursorJson.includes('"mine": { "command": "bar" }'), "foreign entry untouched");
    assert.match(cursorJson, /"run",\s*"fake"/);
    assert.match(readFileSync(codex, "utf8"), /^# my config\nmodel = "x"\n\n# >>> wirebay managed/);

    r = runCli(sb, ["list", "--json"]);
    const listed = JSON.parse(r.stdout);
    assert.deepEqual(listed.servers[0].tools, { codex: "synced", cursor: "synced" });

    r = runCli(sb, ["doctor", "fake", "--json"]);
    const report = JSON.parse(r.stdout);
    const hs = report.checks.find((c: { name: string }) => c.name === "MCP handshake");
    assert.equal(hs.status, "ok", JSON.stringify(report.checks));
    // The fake server lists env:<KEY> for every TEST_* variable it received.
    assert.match(hs.detail, /2 tools/, "exactly echo + env:TEST_TOKEN (TEST_UNDECLARED must not be passed)");

    r = runCli(sb, ["sync", "--dry-run"]);
    assert.equal(r.code, 0);
    assert.match(r.stdout, /up to date/);

    r = runCli(sb, ["remove", "fake", "from", "cursor"]);
    assert.equal(r.code, 0, r.stderr);
    assert.ok(!readFileSync(cursor, "utf8").includes('"fake"'));
    assert.ok(readFileSync(codex, "utf8").includes("mcp_servers.fake"));

    r = runCli(sb, ["unsync", "all", "--yes"]);
    assert.equal(r.code, 0, r.stderr);
    assert.equal(readFileSync(codex, "utf8"), '# my config\nmodel = "x"\n');

    // Leak test: the secret value must not appear anywhere except secrets.env.
    for (const file of allFiles(sb.root)) {
      if (path.basename(file) === "secrets.env") continue;
      assert.ok(!readFileSync(file, "utf8").includes(SENTINEL), `secret leaked into ${file}`);
    }
  } finally {
    sb.cleanup();
  }
});

test("conflicts and drift exit with code 4", () => {
  const sb = sandbox();
  try {
    const { cursor } = setupTools(sb);
    runCli(sb, ["init"]);
    let r = runCli(sb, ["add", "mine", "--command", "node", "to", "cursor"]);
    assert.equal(r.code, 4, r.stdout);
    assert.match(r.stdout, /not created by wirebay/);
    r = runCli(sb, ["add", "other", "--command", "node", "to", "cursor"]);
    assert.equal(r.code, 0);
    writeFileSync(cursor, readFileSync(cursor, "utf8").replace('"other"\n', '"other",\n        "--x"\n'));
    r = runCli(sb, ["sync", "--scope", "user", "to", "cursor"]);
    assert.equal(r.code, 4);
    assert.match(r.stdout, /edited by hand/);
    r = runCli(sb, ["sync", "to", "cursor", "--force"]);
    assert.equal(r.code, 0);
  } finally {
    sb.cleanup();
  }
});

test("export writes files without touching real configs", () => {
  const sb = sandbox();
  try {
    const { cursor } = setupTools(sb);
    runCli(sb, ["init"]);
    runCli(sb, ["add", "x", "--command", "node", "to", "cursor", "--no-sync"]);
    const before = readFileSync(cursor, "utf8");
    const r = runCli(sb, ["export", "cursor"]);
    assert.equal(r.code, 0, r.stderr);
    assert.equal(readFileSync(cursor, "utf8"), before);
    const exported = JSON.parse(readFileSync(path.join(sb.root, "wirebay-export", "cursor", "mcp.json"), "utf8"));
    assert.deepEqual(Object.keys(exported.mcpServers), ["x"]);
  } finally {
    sb.cleanup();
  }
});

test("helpful errors", () => {
  const sb = sandbox();
  try {
    let r = runCli(sb, ["snyc"]);
    assert.equal(r.code, 2);
    assert.match(r.stderr, /Did you mean "sync"/);
    r = runCli(sb, ["add", "cursor", "--npx", "x"]);
    assert.notEqual(r.code, 0);
    r = runCli(sb, ["add", "brand-new"]);
    assert.equal(r.code, 2);
    assert.match(r.stderr, /--npx/);
    r = runCli(sb, ["--version"]);
    assert.match(r.stdout, /^\d+\.\d+\.\d+/);
  } finally {
    sb.cleanup();
  }
});
