# JetBrains Junie

JetBrains' coding agent (IDE plugin and Junie CLI). Official docs: https://junie.jetbrains.com/docs/junie-cli-mcp-configuration.html

## Where the config lives

| Scope   | File                                                                     |
| ------- | ------------------------------------------------------------------------ |
| user    | `~/.junie/mcp/mcp.json` (`%USERPROFILE%\.junie\mcp\mcp.json` on Windows) |
| project | `<project>/.junie/mcp/mcp.json`                                          |

The plugin and the CLI share these files. Servers live under `mcpServers`.

## How wirebay syncs it

```bash
wirebay add context7 to junie        # also accepted: jetbrains, jetbrains-junie
```

## Doing it by hand

```json
{
  "mcpServers": {
    "context7": { "command": "wirebay", "args": ["run", "context7"] }
  }
}
```

On Windows, entries written by hand usually need `cmd /c wirebay run <server>`; wirebay's own entries call `node.exe` directly.

## Verify

Junie CLI: `/mcp` shows each server's status. IDE: the MCP Servers list in Junie's settings.

## Quirks

- **JetBrains AI Assistant** (a different product) keeps MCP servers in IDE settings with no documented file, so wirebay can't write it. Use its "Import from Claude" button after syncing to `desktop`, or paste the output of `wirebay export`.

## Changelog

- 2026-09-25: first version, from the official docs linked above.
