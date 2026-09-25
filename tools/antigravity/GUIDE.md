# Google Antigravity

Official MCP docs: https://antigravity.google/docs/mcp/

## Where the config lives

| Scope | File |
|---|---|
| user | `~/.gemini/config/mcp_config.json` |
| project | `<workspace>/.agents/mcp_config.json` |

Servers live under `mcpServers`. Older Antigravity builds used `~/.gemini/antigravity/mcp_config.json`.

## How wirebay syncs it

```bash
wirebay add github to antigravity        # also accepted: google-antigravity
```

## Doing it by hand

```json
{
  "mcpServers": {
    "github": {"command":"wirebay","args":["run","github"]}
  }
}
```

On Windows, entries written by hand usually need `cmd /c wirebay run <server>`; wirebay's own entries call `node.exe` directly.

## Verify

Open the agent panel → MCP servers ("Manage MCP servers") and check the server and its tools are listed.

## Quirks

- Remote servers in Antigravity use `serverUrl` (not `url`). wirebay's entries are local commands, so this doesn't matter.
- On an older build, point wirebay at `~/.gemini/antigravity/mcp_config.json` with `~/.wirebay/tools/antigravity/tool.json`.

## Changelog

- 2026-09-25: first version, from the official docs linked above.
