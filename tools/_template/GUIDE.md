# My Tool

One sentence: what this tool is.
Official MCP docs: https://example.com/docs/mcp

## Where the config lives

| Scope | File |
|---|---|
| user | `~/.my-tool/mcp.json` |
| project | `<project>/.my-tool/mcp.json` |

Name the key servers live under, and the shape of one entry.

## How wirebay syncs it

```bash
wirebay add github to my-tool
```

Mention anything special: restart needed, a managed block, CLI-based writes…

## Doing it by hand

```json
{
  "mcpServers": {
    "github": { "command": "wirebay", "args": ["run", "github"] }
  }
}
```

## Verify

How to see connected servers and tools inside the tool (menu path, slash command, CLI command).

## Quirks

- Windows `.cmd` shims, PATH in GUI apps, profiles, reload behaviour…

## Changelog

- YYYY-MM-DD: first version.
