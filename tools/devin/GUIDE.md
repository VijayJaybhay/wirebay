# Devin (Devin CLI and Devin Desktop / Windsurf Cascade)

Windsurf was renamed **Devin Desktop** on 2026-06-02. Its **Cascade** agent and the **Devin CLI**
(Devin for Terminal) read the same MCP file, so one entry covers both. Devin CLI docs:
https://docs.devin.ai/cli/extensibility/mcp/configuration. Cascade docs: https://docs.devin.ai/desktop/cascade/mcp
(`docs.windsurf.com/windsurf/cascade/mcp` redirects there).

> **Status: beta.** The Devin Desktop FAQ still mentions the old `~/.codeium` location (see _Quirks_). If your
> servers don't show up, use the override below and please
> [report it](https://github.com/VijayJaybhay/wirebay/issues/new?template=config-changed.yml).

## Where the config lives

| OS            | File (per the Cascade MCP docs)                                                 |
| ------------- | ------------------------------------------------------------------------------- |
| Windows       | `%APPDATA%\devin\mcp_config.json`                                               |
| macOS / Linux | `~/.config/devin/mcp_config.json` (or `$XDG_CONFIG_HOME/devin/mcp_config.json`) |

Project scope: `<project>/.devin/mcp_config.json` (Devin CLI; `.devin/mcp_config.local.json` is the git-ignored variant). The Devin CLI also honours a `DEVIN_MCP_CONFIG` path override. Servers live under
`mcpServers` (the same shape as Claude Desktop).

## How wirebay syncs it

```bash
wirebay add github to devin           # also accepted: windsurf, devin-cli, devin-desktop, cascade
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
  mkdir -p ~/.wirebay/tools/devin
  # copy tools/devin/tool.json there and set configs.user.path to "~/.codeium/windsurf/mcp_config.json"
  ```

- Cascade supports `${env:VAR}` and `${file:/path}` placeholders; wirebay doesn't need them.
- If an admin allowlists MCP servers, any server not on the list is blocked.
- The "Devin Local" agent in Devin Desktop uses the Devin CLI config, which is this same file.

## Changelog

- 2026-09-25: first version (Devin Desktop Cascade path).
