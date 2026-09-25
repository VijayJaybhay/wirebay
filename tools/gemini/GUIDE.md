# Gemini CLI

Google's open-source terminal agent.
Official MCP docs: https://github.com/google-gemini/gemini-cli/blob/main/docs/tools/mcp-server.md

## Where the config lives

| Scope   | File                              |
| ------- | --------------------------------- |
| user    | `~/.gemini/settings.json`         |
| project | `<project>/.gemini/settings.json` |

Servers live under `mcpServers` inside the general settings file. wirebay edits only that key and
keeps every other setting and comment untouched.

## How wirebay syncs it

```bash
wirebay add firebase to gemini
```

**Restart required:** start a new `gemini` session to load changed servers.

## Doing it by hand

```json
{
  "mcpServers": {
    "firebase": { "command": "wirebay", "args": ["run", "firebase"] }
  }
}
```

## Verify

- Inside a session: `/mcp` lists servers, their status and tools.
- `gemini mcp list` (recent versions).

## Quirks

- Gemini CLI supports `timeout` (ms) and `trust` per server. wirebay doesn't set them; add a user
  override in `~/.wirebay/tools/gemini/tool.json` (`entry.extra`) if you need them.

## Changelog

- 2026-09-25: first version.
