// The grammar table: every phrasing in a row must resolve to the same canonical command.

import assert from "node:assert/strict";
import { test } from "node:test";
import { canonical, parse, type Vocabulary } from "../../src/cli/parse.ts";
import { UsageError } from "../../src/core/errors.ts";

const servers = new Set(["github", "netlify", "firebase", "aws-api"]);
const tools: Record<string, string> = {
  "claude-code": "claude-code",
  claude: "claude-code",
  cc: "claude-code",
  "claude-desktop": "claude-desktop",
  desktop: "claude-desktop",
  codex: "codex",
  cursor: "cursor",
  vscode: "vscode",
  code: "vscode",
  gemini: "gemini",
};
const vocab: Vocabulary = {
  isServer: (n) => servers.has(n),
  toolId: (n) => tools[n],
  words: () => [...servers, ...Object.keys(tools)],
};
const canon = (line: string) => canonical(parse(line.split(" ").filter(Boolean), vocab));

const TABLE: [string, string[]][] = [
  ["→ sync servers=default tools=default", ["sync"]],
  ["→ sync servers=all tools=default", ["sync all", "sync --all", "push all", "apply all", "deploy all"]],
  ["→ sync servers=all tools=all", ["sync everything"]],
  ["→ sync servers=default tools=[codex]", ["sync codex", "sync to codex", "sync --to codex", "push to codex"]],
  ["→ sync servers=all tools=[codex]", ["sync all to codex", "sync all codex"]],
  ["→ sync servers=[github] tools=[codex]", ["sync github codex", "sync github to codex", "sync github --to codex", "sync github into codex"]],
  ["→ sync servers=[github] tools=all", ["sync github to all", "sync github --all-tools", "sync github --all"]],
  [
    "→ sync servers=[github,netlify] tools=[codex,cursor]",
    ["sync github netlify to codex cursor", "sync github,netlify --to codex,cursor", "sync github and netlify to codex and cursor"],
  ],
  ["→ add servers=[github] tools=[claude-code]", ["add github to claude", "install github on cc", "add github --to claude-code", "new github for claude"]],
  ["→ add servers=[netlify] tools=all", ["add netlify to all", "add netlify --all"]],
  ["→ remove servers=[github] tools=[cursor]", ["remove github from cursor", "rm github from cursor", "delete github from cursor", "uninstall github from cursor"]],
  ["→ disable servers=[github] tools=[cursor]", ["disable github from cursor", "off github cursor"]],
  ["→ enable servers=[netlify] tools=[cursor,vscode]", ["enable netlify for cursor vscode", "on netlify cursor code"]],
  ["→ remove servers=[github] tools=all", ["rm github from all"]],
  ["→ list servers=default tools=default", ["list", "ls", "status"]],
  ["→ list servers=default tools=[codex]", ["ls codex"]],
];

for (const [expected, phrasings] of TABLE) {
  test(`${expected}`, () => {
    for (const p of phrasings) assert.equal(canon(p), expected, `phrasing: wirebay ${p}`);
  });
}

test("a new server name for add goes to rest", () => {
  const cmd = parse(["add", "linear", "--npx", "@linear/mcp", "--to", "codex"], vocab);
  assert.deepEqual(cmd.rest, ["linear"]);
  assert.deepEqual(cmd.tools, ["codex"]);
  assert.equal(cmd.flags.npx, "@linear/mcp");
});

test("unknown words get a did-you-mean hint", () => {
  assert.throws(
    () => parse(["sync", "gitub"], vocab),
    (e: unknown) => e instanceof UsageError && /Did you mean "github"/.test(e.hint ?? ""),
  );
  assert.throws(
    () => parse(["snyc"], vocab),
    (e: unknown) => e instanceof UsageError && /Did you mean "sync"/.test(e.hint ?? ""),
  );
});

test("flags: short, combined, inline values and repeats", () => {
  const cmd = parse(["sync", "-ny", "--scope=project", "--to", "codex", "--to", "cursor"], vocab);
  assert.equal(cmd.flags["dry-run"], true);
  assert.equal(cmd.flags.yes, true);
  assert.equal(cmd.flags.scope, "project");
  assert.deepEqual(cmd.tools, ["codex", "cursor"]);
});

test("non-targeted verbs keep their words", () => {
  const cmd = parse(["secrets", "set", "GITHUB_PERSONAL_ACCESS_TOKEN"], vocab);
  assert.equal(cmd.verb, "secrets");
  assert.deepEqual(cmd.rest, ["set", "GITHUB_PERSONAL_ACCESS_TOKEN"]);
});
