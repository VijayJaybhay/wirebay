# Kiro (IDE and Kiro CLI)

AWS's Kiro IDE and **Kiro CLI**, which replaced the Amazon Q Developer CLI in November 2025.
Both read the same MCP files. Official docs: https://kiro.dev/docs/mcp/configuration/

## Where the config lives

| Scope   | File                                                                |
| ------- | ------------------------------------------------------------------- |
| user    | `~/.kiro/settings/mcp.json` (`$KIRO_HOME/settings/mcp.json` if set) |
| project | `<project>/.kiro/settings/mcp.json`                                 |

Kiro merges them; the workspace file wins over the user file for the same server name.

## How wirebay syncs it

```bash
wirebay add aws-docs to kiro          # also accepted: kiro-cli, amazon-q, q-cli
wirebay sync to kiro --scope project
```

## Doing it by hand

```json
{
  "mcpServers": {
    "aws-docs": { "command": "wirebay", "args": ["run", "aws-docs"], "disabled": false }
  }
}
```

## Verify

- **Kiro IDE:** Kiro panel → **MCP servers**. Logs are in Output → "Kiro - MCP Logs". Saving the file
  reconnects only the changed servers.
- **Kiro CLI:** `kiro-cli mcp list`, `kiro-cli mcp status --name <server>`, or `/mcp` in a chat.

## Quirks

- Upgrading from Amazon Q CLI copies `~/.aws/amazonq/mcp.json` into `~/.kiro/settings/mcp.json`.
  wirebay only writes the Kiro file.
- Kiro only expands `${VAR}` for variables you approve in settings. wirebay entries don't use
  them, since the launcher provides secrets.
- A tool's full name (server prefix + tool name) can be at most 64 characters, so keep server names short.

## Changelog

- 2026-09-25: first version.
