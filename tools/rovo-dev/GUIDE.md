# Atlassian Rovo Dev CLI

Official MCP docs: https://support.atlassian.com/rovo/docs/connect-to-an-mcp-server-in-rovo-dev-cli/

## Where the config lives

| Scope | File                  |
| ----- | --------------------- |
| user  | `~/.rovodev/mcp.json` |

Servers live under `mcpServers` with `"transport": "stdio"`.

## How wirebay syncs it

```bash
wirebay add github to rovo-dev        # also accepted: rovodev, rovo
```

## Doing it by hand

```json
{
  "mcpServers": {
    "github": { "command": "wirebay", "args": ["run", "github"], "transport": "stdio" }
  }
}
```

On Windows, entries written by hand usually need `cmd /c wirebay run <server>`; wirebay's own entries call `node.exe` directly.

## Verify

Start `acli rovodev run` and check the MCP servers at startup.

## Quirks

- None known.

## Changelog

- 2026-09-25: first version, from the official docs linked above.
