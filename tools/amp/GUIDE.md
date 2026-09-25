# Amp (Sourcegraph)

Official MCP docs: https://ampcode.com/docs/customize/mcp

## Where the config lives

| Scope | File |
|---|---|
| user | macOS/Linux `~/.config/amp/settings.json`, Windows `%APPDATA%\amp\settings.json` |
| project | `<project>/.amp/settings.json` |

Servers live under the **flat** key `"amp.mcpServers"` (the dot is part of the key name).

## How wirebay syncs it

```bash
wirebay add github to amp        # also accepted: ampcode
```

## Doing it by hand

```json
{
  "amp.mcpServers": {
    "github": {"command":"wirebay","args":["run","github"]}
  }
}
```

On Windows, entries written by hand usually need `cmd /c wirebay run <server>`; wirebay's own entries call `node.exe` directly.

## Verify

In Amp, open the MCP servers list (`amp mcp list` in the CLI) and check the server is connected.

## Quirks

- In `tool.json` the root key is written `amp\\.mcpServers`: an escaped dot means "one key", not nesting.

## Changelog

- 2026-09-25: first version, from the official docs linked above.
