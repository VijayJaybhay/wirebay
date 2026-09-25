# Zed

The Zed editor's agent panel. Official docs: https://zed.dev/docs/ai/mcp

## Where the config lives

| Scope | File |
|---|---|
| user | macOS/Linux `~/.config/zed/settings.json` (or `$XDG_CONFIG_HOME/zed/settings.json`), Windows `%APPDATA%\Zed\settings.json` |
| project | `<project>/.zed/settings.json` |

Servers live under **`context_servers`** inside Zed's general settings file (JSONC). wirebay only
edits that key and keeps comments and every other setting.

## How wirebay syncs it

```bash
wirebay add context7 to zed
```

## Doing it by hand

```json
{
  "context_servers": {
    "context7": { "command": "wirebay", "args": ["run", "context7"] }
  }
}
```

On Windows, entries written by hand usually need `cmd /c wirebay run <server>`; wirebay's own entries call `node.exe` directly.

## Verify

Settings → AI → MCP Servers. A green dot ("Server is active") means it's running. No restart is needed.

## Quirks

- Older Zed builds used a nested `"command": { "path", "args" }` form with `"source": "custom"`. Current Zed uses the flat form wirebay writes.
- The macOS/Linux path is the *settings* folder, not Zed's data folder in `~/Library/Application Support`.

## Changelog

- 2026-09-25: first version, from the official docs linked above.
