// End to end: the real CLI against a fake home, fake tool files and a fake MCP server.
// No network, and never the real ~/.wirebay or real tool configs.

import assert from "node:assert/strict";
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { fakeEditor, fakeServer, Sandbox } from "../helpers.ts";

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
    assert.match(r.stdout, /fake needs TEST_TOKEN/);
    assert.match(r.stdout, /wirebay secrets set TEST_TOKEN/, "ends with how to set the missing key");

    r = sb.run(["secrets", "set", "TEST_TOKEN", "--stdin"], { input: SENTINEL });
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

await test("project scope: --project, --dir, subfolders, and tools without project config", () => {
  const sb = new Sandbox();
  try {
    const { cursor } = setupTools(sb);
    const app = path.join(sb.root, "app");
    const nested = path.join(app, "src", "deep");
    mkdirSync(nested, { recursive: true });
    const projectCursor = path.join(app, ".cursor", "mcp.json");
    const projectFile = path.join(app, ".wirebay.json");

    let r = sb.run(["init", "--dir", app]);
    assert.equal(r.code, 0, r.stderr);
    assert.deepEqual((JSON.parse(readFileSync(projectFile, "utf8")) as { servers: object }).servers, {});

    // Added from a subfolder: the project root is found by walking up to .wirebay.json.
    r = sb.run(["add", "local", "--command", "node", "to", "cursor", "--project"], { cwd: nested });
    assert.equal(r.code, 0, r.stderr + r.stdout);
    assert.match(r.stdout, /project /);
    const project = JSON.parse(readFileSync(projectFile, "utf8")) as { servers: Record<string, { tools: string[] }> };
    assert.deepEqual(project.servers, { local: { tools: ["cursor"] } });
    assert.match(readFileSync(projectCursor, "utf8"), /"local"/);
    assert.ok(!readFileSync(cursor, "utf8").includes('"local"'), "global cursor config untouched");

    // A global server lives next to it.
    r = sb.run(["add", "everywhere", "--command", "node", "to", "cursor", "--global"], { cwd: app });
    assert.equal(r.code, 0, r.stderr);
    assert.match(readFileSync(cursor, "utf8"), /"everywhere"/);
    assert.ok(!readFileSync(projectCursor, "utf8").includes('"everywhere"'));

    // list inside the project shows both scopes.
    r = sb.run(["list", "--json"], { cwd: app });
    const both = JSON.parse(r.stdout) as { scopes: { scope: string; servers: { server: string; tools: Record<string, string> }[] }[] };
    assert.deepEqual(
      both.scopes.map((s) => [s.scope, s.servers.map((x) => `${x.server}:${x.tools.cursor ?? "-"}`)]),
      [
        ["user", ["everywhere:synced"]],
        ["project", ["local:synced"]],
      ],
    );

    // Outside the project only the global scope is shown.
    r = sb.run(["list", "--json"]);
    assert.equal((JSON.parse(r.stdout) as { scope: string }).scope, "user");

    // Codex has no project-level config: it is skipped with a hint to use --global.
    r = sb.run(["enable", "local", "for", "codex", "--dir", app]);
    assert.match(r.stdout + r.stderr, /--global/);
    assert.ok(!readFileSync(path.join(sb.home, ".codex", "config.toml"), "utf8").includes("local"));

    // unsync --project only touches the project's files.
    r = sb.run(["unsync", "--project", "--yes"], { cwd: app });
    assert.equal(r.code, 0, r.stderr);
    assert.ok(!readFileSync(projectCursor, "utf8").includes('"local"'));
    assert.match(readFileSync(cursor, "utf8"), /"everywhere"/);

    // An invalid project file is reported, not silently ignored.
    writeFileSync(projectFile, '{ "version": 1, "servers": { "Bad Name": {} } }');
    r = sb.run(["list"], { cwd: app });
    assert.notEqual(r.code, 0);
    assert.match(r.stderr, /not a valid wirebay project config/);

    r = sb.run(["add", "x", "--command", "node", "--project", "--global"]);
    assert.equal(r.code, 2);
    r = sb.run(["list", "--dir", path.join(sb.root, "missing")]);
    assert.equal(r.code, 2);
    assert.match(r.stderr, /does not exist/);
  } finally {
    sb.cleanup();
  }
});

await test("add explains how to get each secret; secrets edit reports what changed", () => {
  const sb = new Sandbox();
  try {
    setupTools(sb);
    sb.run(["init"]);
    let r = sb.run(["add", "grafana", "atlassian", "to", "cursor", "--no-sync"]);
    assert.equal(r.code, 0, r.stderr);
    assert.match(r.stdout, /grafana needs GRAFANA_SERVICE_ACCOUNT_TOKEN/);
    assert.match(r.stdout, /How to get it: .*Service accounts/);
    assert.match(r.stdout, /atlassian signs in through your browser/);
    assert.match(r.stdout, /wirebay secrets edit/);
    const secretsFile = path.join(sb.wirebayHome, "secrets.env");
    assert.match(
      readFileSync(secretsFile, "utf8"),
      /# How to get it: .*grafana\.com.*\r?\nGRAFANA_SERVICE_ACCOUNT_TOKEN=\r?\n/,
      "placeholder explains itself",
    );

    const editor = `"${process.execPath}" --no-warnings "${fakeEditor}" GRAFANA_URL=http://localhost:3000 GRAFANA_SERVICE_ACCOUNT_TOKEN=${SENTINEL}`;
    r = sb.run(["secrets", "edit"], { env: { EDITOR: editor } });
    assert.equal(r.code, 0, r.stderr);
    assert.match(r.stdout, /updated: GRAFANA_SERVICE_ACCOUNT_TOKEN, GRAFANA_URL/);
    assert.match(r.stdout, /No sync needed\. Restart Cursor/);
    assert.ok(!r.stdout.includes(SENTINEL) && !r.stderr.includes(SENTINEL), "values are never printed");
  } finally {
    sb.cleanup();
  }
});
