# Claude Desktop

The Claude desktop app for Windows and macOS.
Official docs: https://modelcontextprotocol.io/docs/develop/connect-local-servers

## Where the config lives

| OS | File |
|---|---|
| Windows | `%APPDATA%\Claude\claude_desktop_config.json` |
| macOS | `~/Library/Application Support/Claude/claude_desktop_config.json` |
| Linux | `~/.config/Claude/claude_desktop_config.json` (no official Linux app; community builds use this path) |

User scope only. The file is also where the app keeps other settings; wirebay only touches keys
inside `mcpServers`.

## How wirebay syncs it

```bash
wirebay add netlify to desktop
```

Claude Desktop only starts **local (stdio)** servers from this file. Remote servers such as GitHub
still work because `wirebay run github` bridges them through `mcp-remote`.

**Restart required:** fully quit Claude Desktop (tray/menu bar icon → Quit), then start it again.

## Doing it by hand

```json
{
  "mcpServers": {
    "netlify": { "command": "wirebay", "args": ["run", "netlify"] }
  }
}
```

On Windows use `"command": "cmd", "args": ["/c", "wirebay", "run", "netlify"]`.

## Verify

Settings → Developer shows each server's status. Logs:
- Windows: `%APPDATA%\Claude\logs\mcp-server-<name>.log`
- macOS: `~/Library/Logs/Claude/mcp-server-<name>.log`

## Quirks

- GUI apps don't inherit your shell `PATH`. wirebay stores absolute paths for `npx`, `uvx` and
  `docker` at `wirebay init`, and the launcher also checks well-known install folders.
- Closing the window does not quit the app. Quit it from the tray or menu bar.

## Changelog

- 2026-09-25: first version.
