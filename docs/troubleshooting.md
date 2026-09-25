# Troubleshooting

Start with:

```bash
wirebay doctor            # everything
wirebay doctor github     # one server
wirebay doctor --json     # safe to paste into an issue: contains no secret values
```

## A server doesn't show up in my tool

1. `wirebay list`: is it `✓` for that tool? If it's `○`, run `wirebay sync`.
2. Restart the tool. Claude Desktop must be fully quit (tray/menu bar → Quit). Gemini CLI needs a new
   session.
3. Check the tool's MCP panel or log (see the tool's guide in the [tools directory](../tools/INDEX.md)).
4. Check `~/.wirebay/logs/<server>.log`.

## "missing required secret(s)"

`wirebay secrets set <KEY>`. `wirebay secrets list` shows what's missing.

## "the server rejected the credentials (HTTP 401)"

The token is wrong, expired, revoked, or not yet approved by your organisation. Create a new one
following the server guide and set it again.

## Cannot find "npx" / "uvx" / "docker"

Install the missing program, then **run `wirebay init` again from a terminal where the command works**.
wirebay stores its absolute path, because desktop apps don't see your shell PATH.

## Server times out on first start

`npx` and `uvx` download the server the first time, which can take a minute (Firebase especially).
Run `wirebay doctor <server>` once to warm the cache, then restart the tool.

## "… was edited by hand since the last sync"

You (or the tool) changed an entry wirebay manages. Either copy your change into the server
definition (`~/.wirebay/servers/<name>.json`) and run `wirebay sync --force`, or keep the hand edit
and leave that tool out: `wirebay disable <server> from <tool>`.

## "… already exists … and was not created by wirebay"

The tool already has a server with the same name. Rename yours (`wirebay remove x`,
`wirebay add x-2 …`), delete the old entry by hand, or replace it with `--force` (a backup is made).

## Codex: "defined … outside the wirebay block"

Delete or rename your own `[mcp_servers.<name>]` table in `~/.codex/config.toml`, then sync.

## After upgrading Node.js, servers stopped starting

Tool entries point at the old node path. `wirebay doctor` flags this; fix it with
`wirebay sync --force`.

## Windows: a console window flashes, or `.cmd` errors

wirebay's default (absolute) entries run `node.exe` directly, which avoids `.cmd` issues. If you use
portable mode, tools that can't start `.cmd` files get `cmd /c`.

## I want my old config back

```bash
wirebay restore <tool> --list
wirebay restore <tool>              # latest backup
wirebay restore <tool> <backup-id>  # a specific one
```

## Still stuck?

Open an issue with `wirebay --version`, your OS, and `wirebay doctor --json`. Never include
`secrets.env` or tokens.
