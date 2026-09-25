# OpenAI Codex (CLI, IDE extension, desktop app)

The Codex CLI, the Codex IDE extension and the Codex desktop app all read the same file.
Official MCP docs: https://developers.openai.com/codex/mcp

## Where the config lives

| Scope | File                                                  |
| ----- | ----------------------------------------------------- |
| user  | `~/.codex/config.toml` (or `$CODEX_HOME/config.toml`) |

Servers are TOML tables named `[mcp_servers.<name>]` with `command`, `args`, `env`, and optional
`startup_timeout_sec` / `tool_timeout_sec`.

## How wirebay syncs it

```bash
wirebay add github to codex
```

TOML libraries drop comments when they rewrite a file, so wirebay keeps **its entries inside a
marked block** and never touches anything outside it:

```toml
# >>> wirebay managed: do not edit by hand, run `wirebay sync` >>>
[mcp_servers.github]
command = "/usr/local/bin/node"
args = [ "/usr/local/lib/node_modules/wirebay/dist/cli.js", "run", "github" ]
startup_timeout_sec = 60
# <<< wirebay managed <<<
```

If a server with the same name is already defined **outside** the block, wirebay reports a conflict.
Remove or rename your own entry and sync again.

`startup_timeout_sec = 60` gives npx/uvx time to download a server on first start. Run
`wirebay doctor` once after adding a server to warm the cache.

## Doing it by hand

```toml
[mcp_servers.github]
command = "wirebay"
args = ["run", "github"]
```

On Windows use `command = "cmd"` and `args = ["/c", "wirebay", "run", "github"]`.

## Verify

- `codex mcp list`
- Inside the TUI: `/mcp`

## Quirks

- One file serves the CLI, the IDE extension and the desktop app. Use `codex`, `codex-cli` or
  `codex-desktop` in wirebay commands; they all mean the same tool.
- `CODEX_HOME` moves the whole folder; wirebay follows it.

## Changelog

- 2026-09-25: first version (managed block).
