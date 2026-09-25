# FAQ

**Does wirebay run a background service?**
No. It edits config files when you run a command. When a tool starts a server, `wirebay run`
starts it and then just passes data through.

**Does it slow servers down?**
Only by the time it takes to start Node.js (tens of milliseconds). After that, stdio goes straight
between the tool and the server.

**Will it mess up my existing MCP config?**
wirebay only changes entries it created, keeps comments and formatting, backs up each file first,
and refuses to overwrite entries you edited by hand unless you pass `--force`.

**Can I still add servers to a tool by hand?**
Yes. wirebay ignores entries it didn't create.

**Why is the secrets file plaintext?**
It's simple, transparent, easy to back up, and works everywhere. It's restricted to your user.
Keychain and password-manager backends are on the [roadmap](roadmap.md); meanwhile you can pipe
values from a password manager (`… | wirebay secrets set KEY --stdin`).

**Do remote (HTTP) servers work in Claude Desktop?**
Yes. `wirebay run` bridges them over stdio with `mcp-remote`, and keeps the token out of the
command line.

**What about OAuth servers?**
Add them with `--oauth`; mcp-remote opens the browser on first use and caches the login.

**Codex CLI and the Codex desktop app, do I sync both?**
They share `~/.codex/config.toml`, so `codex`, `codex-cli` and `codex-desktop` are the same target.

**How do I add a tool wirebay doesn't support yet?**
Write a `tool.json` manifest in `~/.wirebay/tools/<id>/` to use it now, and please contribute it
(see [add a tool](contributing/add-a-tool.md)). It's usually just JSON.

**Does wirebay send telemetry?**
No. wirebay makes no network calls of its own.

**Is there a GUI?**
No. It's a CLI by design.
