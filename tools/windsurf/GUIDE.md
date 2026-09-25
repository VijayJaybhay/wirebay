# Windsurf / Devin Desktop (Cascade)

Windsurf was renamed **Devin Desktop** on 2026-06-02. This entry configures MCP servers for its
**Cascade** agent. Official docs: https://docs.devin.ai/desktop/cascade/mcp
(`docs.windsurf.com/windsurf/cascade/mcp` redirects there).

> **Status: beta.** Two official pages disagree on the file location (see *Quirks*). If your
> servers don't show up, use the override below and please
> [report it](https://github.com/VijayJaybhay/wirebay/issues/new?template=config-changed.yml).

## Where the config lives

| OS | File (per the Cascade MCP docs) |
|---|---|
| Windows | `%APPDATA%\devin\mcp_config.json` |
| macOS / Linux | `~/.config/devin/mcp_config.json` (or `$XDG_CONFIG_HOME/devin/mcp_config.json`) |

User scope only; project-level config isn't documented for Cascade. Servers live under
`mcpServers` (the same shape as Claude Desktop).

## How wirebay syncs it

```bash
wirebay add github to windsurf        # also accepted: devin-desktop, cascade, codeium
```

## Doing it by hand

```json
{
  "mcpServers": {
    "github": { "command": "wirebay", "args": ["run", "github"] }
  }
}
```

On Windows use `"command": "cmd", "args": ["/c", "wirebay", "run", "github"]`.

## Verify

Open Cascade → the MCP (hammer) icon → check that the server is listed and enabled. Cascade can use
at most 100 tools across all servers.

## Quirks

- **Path conflict:** the Devin Desktop FAQ says the MCP config stays at
  `~/.codeium/mcp_config.json` / `~/.codeium/windsurf/mcp_config.json` (the pre-rename location).
  If your install still reads that file, override the path:

  ```bash
  mkdir -p ~/.wirebay/tools/windsurf
  # copy tools/windsurf/tool.json there and set configs.user.path to "~/.codeium/windsurf/mcp_config.json"
  ```
- Cascade supports `${env:VAR}` and `${file:/path}` placeholders; wirebay doesn't need them.
- If an admin allowlists MCP servers, any server not on the list is blocked.
- The newer "Devin Local" agent reads the Devin CLI config; this entry targets Cascade.

## Changelog

- 2026-09-25: first version (Devin Desktop Cascade path).
