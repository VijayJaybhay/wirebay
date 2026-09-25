# Continue

The Continue extension for VS Code and JetBrains. Official docs: https://docs.continue.dev/customize/deep-dives/mcp

> **Status:** beta, project scope only (see below). If something is off, please [report it](https://github.com/VijayJaybhay/wirebay/issues/new?template=config-changed.yml).

## Where the config lives

| Scope | File |
|---|---|
| project | `<workspace>/.continue/mcpServers/wirebay.json` |

Continue's main `~/.continue/config.yaml` stores servers as a **list**, which wirebay doesn't edit.
But Continue reads any JSON file in `.continue/mcpServers/` written in the Claude Desktop/Cursor
format, so wirebay manages its own `wirebay.json` there.

## How wirebay syncs it

```bash
wirebay add github to continue --scope project
```

## Doing it by hand

```json
{
  "mcpServers": {
    "github": { "command": "wirebay", "args": ["run", "github"] }
  }
}
```

On Windows, entries written by hand usually need `cmd /c wirebay run <server>`; wirebay's own entries call `node.exe` directly.

## Verify

MCP tools only work in **agent mode**. Ask the agent to use the server and check that the tools appear.

## Quirks

- There's no user scope yet: `wirebay add github to continue` without `--scope project` is skipped with a note.

## Changelog

- 2026-09-25: first version, from the official docs linked above.
