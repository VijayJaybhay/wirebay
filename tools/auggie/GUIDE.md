# Augment Code CLI (auggie)

Augment's terminal agent. Official docs: https://docs.augmentcode.com/cli/integrations

> **Status:** beta: the Windows path is inferred (`%USERPROFILE%\.augment\settings.json`). If something is off, please [report it](https://github.com/VijayJaybhay/wirebay/issues/new?template=config-changed.yml).

## Where the config lives

| Scope | File |
|---|---|
| user | `~/.augment/settings.json` |

Servers live under `mcpServers` inside auggie's settings file; other settings are left untouched.

## How wirebay syncs it

```bash
wirebay add github to auggie          # also accepted: augment
```

## Doing it by hand

```json
{
  "mcpServers": {
    "github": { "type": "stdio", "command": "wirebay", "args": ["run", "github"] }
  }
}
```

On Windows, entries written by hand usually need `cmd /c wirebay run <server>`; wirebay's own entries call `node.exe` directly.

## Verify

`auggie mcp list`, or `/mcp` in a session. The file is read at startup.

## Quirks

- The Augment **VS Code / JetBrains extensions** manage MCP servers in their own settings UI ("Import from JSON"). This entry covers the CLI.

## Changelog

- 2026-09-25: first version, from the official docs linked above.
