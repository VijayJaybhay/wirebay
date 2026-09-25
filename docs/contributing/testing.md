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
| `test/unit/` | Grammar, templates, secrets store, config formats, launch planning, reconcile rules | Fast; mostly in-process through a sandboxed `AppContext` |
| `test/snapshot/` | Every `tools/*/tool.json` renders exactly like its `examples/`; every preset loads | **Automatic for new tools and presets** |
| `test/e2e/` | The real CLI in a sandbox: init → add → sync → doctor → remove → unsync | Uses `test/fixtures/fake-mcp-server.ts` |

## Sandboxing (required)

Tests must never touch the real home folder. Use the `Sandbox` helper, which gives each test a
temporary home plus an `AppContext` bound to it:

```ts
import { withSandbox } from "../helpers.ts";

test("adds an entry", () =>
  withSandbox((sb) => {
    const ctx = sb.context();                              // services that only see the sandbox
    const r = sb.run(["add", "x", "--command", "node", "to", "cursor"]); // the real CLI
    assert.equal(r.code, 0);
  }));
```

`AppContext` takes the environment as a constructor argument, so there is no global state to
reset between tests.

## The fake MCP server

`test/fixtures/fake-mcp-server.ts` answers `initialize` and `tools/list`, and reports every `TEST_*`
environment variable it received as a tool named `env:<KEY>`. That is how the e2e test proves only
declared secrets reach a server.
- `FAKE_MCP_NOISE=1` makes it print junk on stdout.
- `FAKE_MCP_EXIT_CODE=n` makes it exit immediately with code `n`.

## Leak test

The e2e suite stores a sentinel secret, then scans **every file** in the sandbox (tool configs,
state, logs, backups, exports). The test fails if the value appears anywhere except `secrets.env`.
Keep this passing.

## Updating snapshots

If you intentionally change what wirebay writes, run `npm run gen:docs`, review the diff of
`tools/*/examples/`, and commit it with your change.
