# Qoder CLI

Official MCP docs: https://docs.qoder.com/cli/mcp-servers

> **Status:** beta. If something is off, please [report it](https://github.com/VijayJaybhay/wirebay/issues/new?template=config-changed.yml).

## Where the config lives

| Scope | File                     |
| ----- | ------------------------ |
| user  | `~/.qoder/settings.json` |

Qoder CLI also reads a project `.mcp.json` (Claude Code layout). wirebay leaves that file to the `claude-code` tool, so sync project scope to `claude` if you want it there. The Qoder IDE manages MCP in its settings UI.

## How wirebay syncs it

```bash
wirebay add github to qoder        # also accepted: qodercli
```

## Doing it by hand

```json
{
  "mcpServers": {
    "github": { "command": "wirebay", "args": ["run", "github"] }
  }
}
```

On Windows, entries written by hand usually need `cmd /c wirebay run <server>`; wirebay's own entries call `node.exe` directly.

## Verify

Run `/mcp` in a Qoder CLI session.

## Quirks

- None known.

## Changelog

- 2026-09-25: first version, from the official docs linked above.
