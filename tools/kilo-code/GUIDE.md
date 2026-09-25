# Kilo Code (extension and CLI)

Official MCP docs: https://kilo.ai/docs/automate/mcp/using-in-kilo-code

## Where the config lives

| Scope   | File                                           |
| ------- | ---------------------------------------------- |
| user    | `~/.config/kilo/kilo.jsonc` (all OSes)         |
| project | `<project>/kilo.jsonc` (or `.kilo/kilo.jsonc`) |

Kilo Code now uses the opencode format: servers live under `mcp`, `command` is **one array** including arguments, and env values go in `environment`.

## How wirebay syncs it

```bash
wirebay add github to kilo-code        # also accepted: kilo, kilocode
```

## Doing it by hand

```json
{
  "mcp": {
    "github": { "type": "local", "command": ["wirebay", "run", "github"], "enabled": true }
  }
}
```

On Windows, entries written by hand usually need `cmd /c wirebay run <server>`; wirebay's own entries call `node.exe` directly.

## Verify

Kilo Code panel → MCP servers, or `kilo mcp list` in the CLI.

## Quirks

- If you use `kilo.json` instead of `kilo.jsonc`, override the path in `~/.wirebay/tools/kilo-code/tool.json`.

## Changelog

- 2026-09-25: first version, from the official docs linked above.
