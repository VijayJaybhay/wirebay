// End to end: the real CLI against a fake home, fake tool files and a fake MCP server.
// No network, and never the real ~/.wirebay or real tool configs.

import assert from "node:assert/strict";
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { fakeServer, Sandbox } from "../helpers.ts";

const SENTINEL = "sentinel_secret_value_4f9a2c";

function setupTools(sb: Sandbox): { cursor: string; codex: string } {
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

await test("init → add → list → doctor → remove → unsync", () => {
  const sb = new Sandbox();
  try {
    const { cursor, codex } = setupTools(sb);
    let r = sb.run(["init"]);
    assert.equal(r.code, 0, r.stderr);

    r = sb.run([
      "add",
      "fake",
      "--command",
      process.execPath,
      "--arg",
      "--no-warnings",
      "--arg",
      fakeServer,
      "--secret",
      "TEST_TOKEN",
      "to",
      "cursor",
      "codex",
    ]);
    assert.equal(r.code, 0, r.stderr + r.stdout);
    assert.match(r.stderr, /needs TEST_TOKEN/);

    r = sb.run(["secrets", "set", "TEST_TOKEN", "--stdin"], SENTINEL);
    assert.equal(r.code, 0, r.stderr);
    assert.ok(!r.stdout.includes(SENTINEL), "secret echoed");
    writeFileSync(path.join(sb.wirebayHome, "secrets.env"), `TEST_UNDECLARED=nope\n`, { flag: "a" });

    const cursorJson = readFileSync(cursor, "utf8");
    assert.ok(cursorJson.includes('"mine": { "command": "bar" }'), "foreign entry untouched");
    assert.match(cursorJson, /"run",\s*"fake"/);
    assert.match(readFileSync(codex, "utf8"), /^# my config\nmodel = "x"\n\n# >>> wirebay managed/);

    r = sb.run(["list", "--json"]);
    const listed = JSON.parse(r.stdout) as { servers: { tools: Record<string, string> }[] };
    assert.deepEqual(listed.servers[0]?.tools, { codex: "synced", cursor: "synced" });

    r = sb.run(["doctor", "fake", "--json"]);
    const report = JSON.parse(r.stdout) as { checks: { name: string; status: string; detail?: string }[] };
    const hs = report.checks.find((c) => c.name === "MCP handshake");
    assert.ok(hs, "doctor reported a handshake check");
    assert.equal(hs.status, "ok", JSON.stringify(report.checks));
    // The fake server lists env:<KEY> for every TEST_* variable it received.
    assert.match(hs.detail ?? "", /2 tools/, "exactly echo + env:TEST_TOKEN (TEST_UNDECLARED must not be passed)");

    r = sb.run(["sync", "--dry-run"]);
    assert.equal(r.code, 0);
    assert.match(r.stdout, /up to date/);

    r = sb.run(["remove", "fake", "from", "cursor"]);
    assert.equal(r.code, 0, r.stderr);
    assert.ok(!readFileSync(cursor, "utf8").includes('"fake"'));
    assert.ok(readFileSync(codex, "utf8").includes("mcp_servers.fake"));

    r = sb.run(["unsync", "all", "--yes"]);
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

await test("conflicts and drift exit with code 4", () => {
  const sb = new Sandbox();
  try {
    const { cursor } = setupTools(sb);
    sb.run(["init"]);
    let r = sb.run(["add", "mine", "--command", "node", "to", "cursor"]);
    assert.equal(r.code, 4, r.stdout);
    assert.match(r.stdout, /not created by wirebay/);
    r = sb.run(["add", "other", "--command", "node", "to", "cursor"]);
    assert.equal(r.code, 0);
    writeFileSync(cursor, readFileSync(cursor, "utf8").replace('"other"\n', '"other",\n        "--x"\n'));
    r = sb.run(["sync", "--scope", "user", "to", "cursor"]);
    assert.equal(r.code, 4);
    assert.match(r.stdout, /edited by hand/);
    r = sb.run(["sync", "to", "cursor", "--force"]);
    assert.equal(r.code, 0);
  } finally {
    sb.cleanup();
  }
});

await test("export writes files without touching real configs", () => {
  const sb = new Sandbox();
  try {
    const { cursor } = setupTools(sb);
    sb.run(["init"]);
    sb.run(["add", "x", "--command", "node", "to", "cursor", "--no-sync"]);
    const before = readFileSync(cursor, "utf8");
    const r = sb.run(["export", "cursor"]);
    assert.equal(r.code, 0, r.stderr);
    assert.equal(readFileSync(cursor, "utf8"), before);
    const exported = JSON.parse(readFileSync(path.join(sb.root, "wirebay-export", "cursor", "mcp.json"), "utf8")) as {
      mcpServers: Record<string, unknown>;
    };
    assert.deepEqual(Object.keys(exported.mcpServers), ["x"]);
  } finally {
    sb.cleanup();
  }
});

await test("helpful errors", () => {
  const sb = new Sandbox();
  try {
    let r = sb.run(["snyc"]);
    assert.equal(r.code, 2);
    assert.match(r.stderr, /Did you mean "sync"/);
    r = sb.run(["add", "cursor", "--npx", "x"]);
    assert.notEqual(r.code, 0);
    r = sb.run(["add", "brand-new"]);
    assert.equal(r.code, 2);
    assert.match(r.stderr, /--npx/);
    r = sb.run(["--version"]);
    assert.match(r.stdout, /^\d+\.\d+\.\d+/);
  } finally {
    sb.cleanup();
  }
});
