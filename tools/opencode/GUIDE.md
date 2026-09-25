# opencode

The open-source terminal coding agent. Official docs: https://opencode.ai/docs/mcp-servers/

> **Status:** beta: the Windows user path isn't stated in the docs (wirebay uses `%USERPROFILE%\.config\opencode\opencode.json`). If something is off, please [report it](https://github.com/VijayJaybhay/wirebay/issues/new?template=config-changed.yml).

## Where the config lives

| Scope   | File                               |
| ------- | ---------------------------------- |
| user    | `~/.config/opencode/opencode.json` |
| project | `<project>/opencode.json`          |

Servers live under **`mcp`**. opencode differs from most tools:

- `command` is **one array** that includes the arguments.
- Environment variables go in **`environment`**.
- `type: "local"` is required.

## How wirebay syncs it

```bash
wirebay add playwright to opencode
```

## Doing it by hand

```json
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "playwright": { "type": "local", "command": ["wirebay", "run", "playwright"], "enabled": true }
  }
}
```

On Windows, entries written by hand usually need `cmd /c wirebay run <server>`; wirebay's own entries call `node.exe` directly.

## Verify

`opencode mcp list` (or `opencode mcp debug <name>`). Restart opencode after changes.

## Quirks

- The default startup `timeout` is 5000 ms, which may be too short for a first `npx` download. Run `wirebay doctor <server>` first to warm the cache.
- opencode also accepts `opencode.jsonc`. wirebay writes `opencode.json`; if you use `.jsonc`, override the path in `~/.wirebay/tools/opencode/tool.json`.

## Changelog

- 2026-09-25: first version, from the official docs linked above.
