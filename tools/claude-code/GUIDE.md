# Claude Code

Anthropic's agentic coding CLI (also used by the Claude Code IDE extensions and desktop app).
Official MCP docs: https://docs.claude.com/en/docs/claude-code/mcp

## Where the config lives

| Scope | File | Notes |
|---|---|---|
| user | `~/.claude.json` (top-level `mcpServers`) | Available in every project. wirebay writes it through `claude mcp add-json -s user`, never by editing the file directly |
| project | `<project>/.mcp.json` | Meant to be committed; Claude Code asks each person to approve these servers |

## How wirebay syncs it

```bash
wirebay add github to claude          # user scope (default)
wirebay sync to claude --scope project  # writes ./.mcp.json with portable entries
```

User scope: wirebay backs up `~/.claude.json`, then runs `claude mcp remove -s user <name>` and
`claude mcp add-json -s user <name> '<entry>'`. If the `claude` command is not on PATH, it edits the
file directly (still with a backup).

Project scope uses the **portable** form (`wirebay run <server>`, with `cmd /c` on Windows), so the
committed file has no machine-specific paths and each teammate uses their own `secrets.env`.

## Doing it by hand

```bash
claude mcp add-json -s user github '{"type":"stdio","command":"wirebay","args":["run","github"]}'
```

## Verify

- `claude mcp list` shows the server and its connection status.
- Inside a session, `/mcp` lists servers and tools.

## Quirks

- On Windows, Claude Code cannot start `.cmd` shims such as `npx.cmd` directly. wirebay's absolute
  mode uses `node.exe` + the wirebay script, which avoids this. Portable mode uses `cmd /c`.
- There is also a *local* scope (per-project, private, stored in `~/.claude.json`). wirebay does not
  manage it.
- `~/.claude.json` also holds Claude Code's own state. Don't restore an old backup of it unless you
  really need to.

## Changelog

- 2026-09-25: first version (user scope via CLI, project `.mcp.json`).
