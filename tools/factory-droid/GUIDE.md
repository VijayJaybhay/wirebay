# Factory Droid

Official MCP docs: https://docs.factory.ai/cli/configuration/mcp

## Where the config lives

| Scope | File |
|---|---|
| user | `~/.factory/mcp.json` |
| project | `<project>/.factory/mcp.json` (also read from parent folders) |

Servers live under `mcpServers`.

## How wirebay syncs it

```bash
wirebay add github to factory-droid        # also accepted: droid, factory
```

## Doing it by hand

```json
{
  "mcpServers": {
    "github": {"type":"stdio","command":"wirebay","args":["run","github"]}
  }
}
```

On Windows, entries written by hand usually need `cmd /c wirebay run <server>`; wirebay's own entries call `node.exe` directly.

## Verify

In a Droid session, run `/mcp` to see servers and their status.

## Quirks

- Droid expands `${VAR}` in env values; wirebay entries don't need it because the launcher provides secrets.

## Changelog

- 2026-09-25: first version, from the official docs linked above.
