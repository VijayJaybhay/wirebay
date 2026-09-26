# Getting started

This takes about five minutes. You'll install wirebay, add the GitHub MCP server to every AI tool
on your machine, and check that it works.

## 1. Install

```bash
npm install -g @pragnalabs.ai/wirebay
wirebay --version
```

You need Node.js 24 or newer (`node --version`). See [installation](installation.md) for details.

## 2. Initialise

```bash
wirebay init
```

This creates `~/.wirebay/`:

- `secrets.env`, readable only by you
- `config.json`
- folders for backups and logs

It also records where `npx`, `uvx` and `docker` live and detects which AI tools are installed.

## 3. Add a server

```bash
wirebay presets                 # see the built-in servers
wirebay add github to all
```

wirebay asks for the GitHub token (input is hidden) and saves it to `secrets.env`. It then writes
a `github` entry into each detected tool's config. See the
[GitHub guide](servers/github.md#1-create-a-token) for creating the token.

Only want some tools? Name them: `wirebay add github to codex cursor`.

## 4. Check it works

```bash
wirebay doctor
```

`doctor` starts each server once, performs a real MCP handshake and reports the number of tools. It
also downloads packages the first time, so the AI tools start the server faster later.

## 5. Restart your tools

wirebay tells you which tools need a restart (for example Claude Desktop). Then ask your assistant
something like _"list my open pull requests"_.

## What just happened?

```bash
wirebay list
```

```
SERVER   claude-code  codex  cursor  SECRETS
github   ✓            ✓      ✓       ok
```

Each tool now has an entry like:

```json
"github": { "command": "/usr/local/bin/node", "args": [".../wirebay/dist/cli.js", "run", "github"] }
```

No token is in any tool file. When a tool starts the server, `wirebay run github` reads the token
from `~/.wirebay/secrets.env` and passes it to the real server.

## Next steps

- Add more: `wirebay add netlify to all`, `wirebay add aws-docs to all`
- Rotate a token: `wirebay secrets set GITHUB_PERSONAL_ACCESS_TOKEN`
- Any other server: [custom servers](servers/custom-servers.md)
- Share servers with your team through a repo: [teams](teams.md)
