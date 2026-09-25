# Custom servers

Any MCP server works with wirebay, not just the presets.

## Add one with a single command

```bash
# npm package (run with npx)
wirebay add linear --npx @linear/mcp-server@1.0.0 --secret LINEAR_API_KEY --to claude codex

# Python package (run with uvx)
wirebay add my-tool --uvx my-mcp-server==0.3.0 --env LOG_LEVEL=info

# Docker image (declared secrets are passed with -e automatically)
wirebay add pg --docker mcp/postgres --secret DATABASE_URL

# Remote server with a bearer token
wirebay add acme --url https://mcp.acme.dev/mcp --secret ACME_TOKEN

# Remote server that uses browser OAuth
wirebay add sentry --url https://mcp.sentry.dev/mcp --oauth

# Anything else
wirebay add local --command /path/to/server --arg --stdio
```

| Option                   | Meaning                                                                                   |
| ------------------------ | ----------------------------------------------------------------------------------------- |
| `--secret KEY`           | Required secret (repeatable). wirebay asks for it and adds a placeholder to `secrets.env` |
| `--optional-secret KEY`  | Optional secret (repeatable)                                                              |
| `--env KEY=value`        | Non-secret environment value (repeatable)                                                 |
| `--arg value`            | Extra argument for the server (repeatable)                                                |
| `--header "Name: value"` | Non-secret HTTP header for `--url` servers (repeatable)                                   |
| `--oauth`                | Remote server authenticates in the browser (via mcp-remote)                               |
| `--description "…"`      | One-line description stored in the definition                                             |

Names must be lowercase letters, digits and dashes, and can't clash with a tool name (like `cursor`)
or a reserved word (like `all`).

## The definition file

`wirebay add` writes `~/.wirebay/servers/<name>.json`. You can edit it by hand; the format is
[`schemas/server.schema.json`](../../schemas/server.schema.json):

```json
{
  "$schema": "https://raw.githubusercontent.com/VijayJaybhay/wirebay/main/schemas/server.schema.json",
  "version": 1,
  "name": "linear",
  "description": "Linear issues and projects",
  "launch": { "type": "stdio", "command": "npx", "args": ["-y", "@linear/mcp-server@1.0.0"] },
  "secrets": [{ "key": "LINEAR_API_KEY", "required": true }],
  "env": { "LOG_LEVEL": "error" }
}
```

- `args` and `env` values may use `${VAR}` and `${VAR:-default}`. Variables come from the declared
  secrets.
- `{ "optional": ["--flag", "${VAR}"] }` in `args` is dropped when `VAR` is empty.
- Remote servers: `"launch": { "type": "remote", "url": "…", "auth": { "type": "bearer", "secret": "KEY" }, "headers": { "X-Thing": "${OTHER}" } }`.
  `auth` can also be `{ "type": "header", "header": "X-Api-Key", "secret": "KEY" }`, `{ "type": "oauth" }` or `{ "type": "none" }`.

After editing, run `wirebay sync` (only needed if you changed the name) and `wirebay doctor <name>`.

## Overriding a preset

Create `~/.wirebay/servers/<preset>.json` with only the fields you want to change. They are merged over
the built-in preset (objects merge; arrays and values replace):

```json
{ "variant": "docker" }
```

```json
{ "launch": { "type": "stdio", "command": "npx", "args": ["-y", "@netlify/mcp@latest"] } }
```

## Share it with everyone

If a server is useful to others, turn it into a built-in preset. See [Add a server](../contributing/add-a-server.md).
