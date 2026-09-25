# Netlify MCP server

Netlify's official MCP server: https://docs.netlify.com/build/build-with-ai/netlify-mcp-server/
(npm package [`@netlify/mcp`](https://www.npmjs.com/package/@netlify/mcp)).

## What it gives you

Tools to create and manage projects (sites), deploy, read deploy status and logs, manage
environment variables and secrets, forms, extensions, and team information.

> **Risk:** the token has the same access as your Netlify account, so an AI tool can deploy and
> change environment variables. Use a separate token for MCP so you can revoke it on its own.

## Setup guide

### Prerequisites

Node.js (for `npx`). The first start downloads the package; run `wirebay doctor netlify` once to warm the cache.

### 1. Create a token

1. Open https://app.netlify.com/user/applications#personal-access-tokens
   (avatar → **User settings** → **Applications** → **Personal access tokens**).
2. **New access token**, give it a name like `wirebay-mcp`, and choose an expiration.
3. Copy the token. It starts with `nfp_`.

## Secrets

```bash
wirebay secrets set NETLIFY_PERSONAL_ACCESS_TOKEN
```

## Config guide

```bash
wirebay add netlify to all
```

The server runs as `npx -y @netlify/mcp@1.15.1`. To use a newer version before wirebay updates the
preset, create `~/.wirebay/servers/netlify.json`:

```json
{ "launch": { "type": "stdio", "command": "npx", "args": ["-y", "@netlify/mcp@latest"] } }
```

## Verify

```bash
wirebay doctor netlify
```

Expect `netlify-mcp 1.x · N tools`. Then ask: _"List my Netlify sites and their last deploy status."_

## Troubleshooting

| Symptom                                  | Fix                                                                                                   |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Tool calls fail with 401                 | The token is wrong, expired or revoked. Run `wirebay secrets set NETLIFY_PERSONAL_ACCESS_TOKEN`.      |
| Server times out on first start in Codex | The first `npx` download can take a minute. Run `wirebay doctor netlify` once, then restart the tool. |
| `Cannot find "npx"`                      | Install Node.js, then run `wirebay init` again.                                                       |

**Rotating the token:** create a new token, run `wirebay secrets set NETLIFY_PERSONAL_ACCESS_TOKEN`,
restart your AI tool, then delete the old token in Netlify.
