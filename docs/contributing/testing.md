# Testing

```bash
npm test                                   # everything
node --test test/unit/parse.test.ts        # one file
node --test --test-name-pattern="drift"    # by name
```

Tests use Node's built-in runner (`node:test`); there's no framework to learn.

## Suites

| Folder | What | Notes |
|---|---|---|
| `test/unit/` | Pure logic: grammar, templates, secrets file, merges, launcher env, reconcile rules | Fast, no subprocesses |
| `test/snapshot/` | Every `tools/*/tool.json` renders exactly like its `examples/` | **Automatic for new tools** |
| `test/e2e/` | The real CLI in a sandbox: init → add → sync → doctor → remove → unsync | Uses `test/fixtures/fake-mcp-server.ts` |

## Sandboxing (required)

Tests must never touch the real home folder. Use the helpers:

```ts
import { sandbox, runCli } from "../helpers.ts";

const sb = sandbox();           // temp home; sets WIREBAY_USER_HOME and WIREBAY_HOME
try {
  const r = runCli(sb, ["add", "x", "--command", "node", "to", "cursor"]);
  assert.equal(r.code, 0);
} finally {
  sb.cleanup();
}
```

## The fake MCP server

`test/fixtures/fake-mcp-server.ts` answers `initialize` and `tools/list`, and reports every `TEST_*`
environment variable it received as a tool named `env:<KEY>`. That's how the e2e test proves only
declared secrets reach a server. `FAKE_MCP_NOISE=1` makes it print junk on stdout, and
`FAKE_MCP_EXIT_CODE=n` makes it exit immediately.

## Leak test

The e2e suite stores a sentinel secret and then scans **every file** in the sandbox (tool configs,
state, logs, backups, exports) to check the value appears only in `secrets.env`. Keep this passing.

## Updating snapshots

If you intentionally change what wirebay writes, run `npm run gen:docs`, review the diff of
`tools/*/examples/`, and commit it with your change.
