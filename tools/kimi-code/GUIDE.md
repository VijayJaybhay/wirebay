# Kimi Code CLI (Moonshot)

Official MCP docs: https://www.kimi.com/code/docs/en/kimi-code-cli/customization/mcp.html

> **Status:** beta: paths are documented; per-server optional fields are not fully verified. If something is off, please [report it](https://github.com/pragnalabs-ai/wirebay/issues/new?template=config-changed.yml).

## Where the config lives

| Scope   | File                                                        |
| ------- | ----------------------------------------------------------- |
| user    | `~/.kimi-code/mcp.json` (`$KIMI_CODE_HOME/mcp.json` if set) |
| project | `<project>/.kimi-code/mcp.json`                             |

The legacy Python `kimi-cli` used `~/.kimi/mcp.json`.

## How wirebay syncs it

```bash
wirebay add github to kimi-code        # also accepted: kimi
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

Start a new session and list MCP tools.

## Quirks

- For the legacy `kimi-cli`, override the path to `~/.kimi/mcp.json`.

## Changelog

- 2026-09-25: first version, from the official docs linked above.
