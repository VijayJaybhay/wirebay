# Tabnine Agent (IDE and CLI)

Official MCP docs: https://docs.tabnine.com/main/getting-started/tabnine-agent/mcp-intro-and-setup/mcp-server-config

> **Status:** beta: older Tabnine builds used `.tabnine/mcp_servers.json`. If something is off, please [report it](https://github.com/VijayJaybhay/wirebay/issues/new?template=config-changed.yml).

## Where the config lives

| Scope   | File                                     |
| ------- | ---------------------------------------- |
| user    | `~/.tabnine/agent/settings.json`         |
| project | `<project>/.tabnine/agent/settings.json` |

Servers live under `mcpServers`.

## How wirebay syncs it

```bash
wirebay add github to tabnine
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

Tabnine Agent → MCP settings lists the server and its tools.

## Quirks

- On older builds, override the path to `.tabnine/mcp_servers.json`.

## Changelog

- 2026-09-25: first version, from the official docs linked above.
