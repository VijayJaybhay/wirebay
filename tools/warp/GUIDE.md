# Warp

The Warp terminal's agents. Official docs: https://docs.warp.dev/knowledge-and-collaboration/mcp

> **Status:** beta: Windows/Linux paths aren't stated separately in the docs. If something is off, please [report it](https://github.com/VijayJaybhay/wirebay/issues/new?template=config-changed.yml).

## Where the config lives

| Scope   | File                        |
| ------- | --------------------------- |
| user    | `~/.warp/.mcp.json`         |
| project | `<project>/.warp/.mcp.json` |

Warp can also read other tools' files (Claude Code, Codex). If you already sync to those, you may
see servers twice; turn off "Auto-spawn servers from third-party agents" or sync to only one.

## How wirebay syncs it

```bash
wirebay add github to warp
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

Settings → Agents → MCP servers shows each server with Start/Stop controls.

## Quirks

- Servers added in Warp's UI may be stored elsewhere (Warp Drive); wirebay only manages the file.

## Changelog

- 2026-09-25: first version, from the official docs linked above.
