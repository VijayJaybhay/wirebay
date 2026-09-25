# Visual Studio Code (GitHub Copilot agent mode)

VS Code's built-in MCP support, used by Copilot Chat in agent mode.
Official docs: https://code.visualstudio.com/docs/copilot/customization/mcp-servers

## Where the config lives

| Scope   | File                                                                                                                                   |
| ------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| user    | Windows `%APPDATA%\Code\User\mcp.json`, macOS `~/Library/Application Support/Code/User/mcp.json`, Linux `~/.config/Code/User/mcp.json` |
| project | `<workspace>/.vscode/mcp.json`                                                                                                         |

The top-level key is **`servers`** (not `mcpServers`), and each entry has `"type": "stdio"`. The file
is JSONC, so comments are allowed and wirebay keeps them.

## How wirebay syncs it

```bash
wirebay add github to vscode          # also accepted: code, vs-code
wirebay sync to code --scope project
```

## Doing it by hand

```jsonc
{
  "servers": {
    "github": { "type": "stdio", "command": "wirebay", "args": ["run", "github"] },
  },
}
```

## Verify

Command Palette → **MCP: List Servers**. From there you can start, stop or restart a server and
see its output. In Copilot Chat, switch to _Agent_ mode and open the tools picker.

## Quirks

- If you use VS Code **profiles**, a non-default profile has its own `mcp.json` under
  `User/profiles/<id>/`. wirebay writes the default profile's file.
- VS Code Insiders uses `Code - Insiders` instead of `Code` in the path. Add a user override in
  `~/.wirebay/tools/vscode/tool.json` if you use Insiders.
- VS Code can start `.cmd` shims on Windows, so portable entries don't need `cmd /c`.

## Changelog

- 2026-09-25: first version.
