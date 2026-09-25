# Cursor

The Cursor AI code editor.
Official MCP docs: https://cursor.com/docs/context/mcp

## Where the config lives

| Scope   | File                         |
| ------- | ---------------------------- |
| user    | `~/.cursor/mcp.json`         |
| project | `<project>/.cursor/mcp.json` |

Servers live under `mcpServers` with `command`, `args` and `env`.

## How wirebay syncs it

```bash
wirebay add netlify to cursor
wirebay sync to cursor --scope project   # portable entries for a shared repo
```

Comments and formatting in `mcp.json` are kept; only wirebay's entries change.

## Doing it by hand

```json
{
  "mcpServers": {
    "netlify": { "command": "wirebay", "args": ["run", "netlify"] }
  }
}
```

## Verify

Cursor Settings → MCP (Tools & Integrations) lists each server with a status dot and its tools.
Toggle a server off and on to restart it after changing a secret.

## Quirks

- Cursor reloads `mcp.json` automatically. If a server shows red, open its log from the MCP settings.
- On Windows, use `cmd /c` for `.cmd` shims when writing entries by hand.

## Changelog

- 2026-09-25: first version. Cursor CLI (`cursor-agent`) uses the same files, so `cursor-cli` is an alias.
