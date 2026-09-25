# Visual Studio 2022/2026 (Windows)

Official MCP docs: https://learn.microsoft.com/en-us/visualstudio/ide/mcp-servers

> **Status:** beta: the stdio entry shape follows VS Code's format; Microsoft's page only shows a remote example. If something is off, please [report it](https://github.com/VijayJaybhay/wirebay/issues/new?template=config-changed.yml).

## Where the config lives

| Scope | File |
|---|---|
| user | `%USERPROFILE%\.mcp.json` (Windows only) |
| project | `<solution>/.vs/mcp.json` |

Servers live under **`servers`** (VS Code style). Visual Studio 17.14+ also reads `<solution>/.mcp.json`, `.vscode/mcp.json` and `.cursor/mcp.json`, so servers synced to VS Code or Cursor project scope may appear too.

## How wirebay syncs it

```bash
wirebay add github to visual-studio        # also accepted: vs, visualstudio
```

## Doing it by hand

```json
{
  "servers": {
    "github": {"type":"stdio","command":"wirebay","args":["run","github"]}
  }
}
```

On Windows, entries written by hand usually need `cmd /c wirebay run <server>`; wirebay's own entries call `node.exe` directly.

## Verify

Copilot Chat → Agent mode → tools picker lists the server's tools.

## Quirks

- Windows only: on macOS/Linux this tool has no user scope.

## Changelog

- 2026-09-25: first version, from the official docs linked above.
