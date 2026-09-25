# GitHub Copilot CLI

GitHub's terminal agent (`copilot`).
Official docs: https://docs.github.com/en/copilot/how-tos/copilot-cli/customize-copilot/add-mcp-servers

## Where the config lives

| Scope   | File                                                                  |
| ------- | --------------------------------------------------------------------- |
| user    | `~/.copilot/mcp-config.json` (`$COPILOT_HOME/mcp-config.json` if set) |
| project | `<repo>/.github/mcp.json` (committed)                                 |

Copilot CLI also reads a per-checkout `.mcp.json`. wirebay uses `.github/mcp.json` for project scope
so it never collides with Claude Code, which owns `.mcp.json`. `.vscode/mcp.json` is not read by
Copilot CLI.

## How wirebay syncs it

```bash
wirebay add netlify to copilot        # also accepted: copilot-cli, gh-copilot
```

Entries use `"type": "local"` and `"tools": ["*"]` (all tools allowed), as in GitHub's examples.

## Doing it by hand

```json
{
  "mcpServers": {
    "netlify": { "type": "local", "command": "wirebay", "args": ["run", "netlify"], "tools": ["*"] }
  }
}
```

## Verify

- In a session: `/mcp show netlify`
- In a terminal: `copilot mcp get netlify`

## Quirks

- Copilot CLI has the GitHub MCP server **built in**, so you may not need wirebay's `github`
  preset there.
- To restrict tools, edit `"tools"` in `~/.wirebay/tools/copilot-cli/tool.json` (`entry.stdio`).

## Changelog

- 2026-09-25: first version.
