# Qwen Code

Official MCP docs: https://qwenlm.github.io/qwen-code-docs/en/users/features/mcp/

## Where the config lives

| Scope | File |
|---|---|
| user | `~/.qwen/settings.json` |
| project | `<project>/.qwen/settings.json` |

Same format as Gemini CLI: servers live under `mcpServers` inside the settings file; other settings are kept.

## How wirebay syncs it

```bash
wirebay add github to qwen-code        # also accepted: qwen
```

## Doing it by hand

```json
{
  "mcpServers": {
    "github": {"command":"wirebay","args":["run","github"]}
  }
}
```

On Windows, entries written by hand usually need `cmd /c wirebay run <server>`; wirebay's own entries call `node.exe` directly.

## Verify

Start a new session and run `/mcp`.

## Quirks

- Qwen Code supports a per-server `timeout` (ms); add it via `entry.extra` in a user override if needed.

## Changelog

- 2026-09-25: first version, from the official docs linked above.
