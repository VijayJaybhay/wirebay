# GitHub MCP server

GitHub's official MCP server: https://github.com/github/github-mcp-server

## What it gives you

Tools for repositories (files, branches, commits, code search), issues, pull requests (read,
review, create, merge), GitHub Actions (workflow runs and logs), code security alerts, and more.
They are grouped into **toolsets** that you can switch on and off.

> **Risk:** with write permissions, an AI tool can push commits, open and merge PRs, and change
> issues. Give the token only the repositories and permissions you actually want to allow.

## Setup guide

### Prerequisites

- **Default (remote server):** Node.js. wirebay bridges GitHub's hosted server through `mcp-remote`.
- **Docker variant:** Docker Desktop or Docker Engine. Use this for GitHub Enterprise Server or to run fully locally.

### 1. Create a token

1. Open https://github.com/settings/personal-access-tokens/new (**fine-grained** token).
2. **Resource owner:** you or your organisation. **Expiration:** 90 days is a good default.
3. **Repository access:** *Only select repositories* (recommended) or *All repositories*.
4. **Permissions**, a sensible starting point:

   | Permission | Access | Needed for |
   |---|---|---|
   | Contents | Read and write (Read-only for browsing only) | files, branches, commits |
   | Issues | Read and write | issues |
   | Pull requests | Read and write | PRs and reviews |
   | Actions | Read-only | workflow runs and logs |
   | Metadata | Read-only (automatic) | required |

5. **Generate token** and copy it. It starts with `github_pat_`.

Organisations may need to approve fine-grained tokens first. Classic tokens (`ghp_…`) also work
but can't be limited to specific repositories.

## Secrets

```bash
wirebay secrets set GITHUB_PERSONAL_ACCESS_TOKEN   # paste the token when asked
```

Optional keys in `~/.wirebay/secrets.env`:

| Key | Meaning |
|---|---|
| `GITHUB_TOOLSETS` | Comma-separated toolsets, e.g. `repos,issues,pull_requests,actions`. Leave empty for GitHub's defaults. |
| `GITHUB_MCP_URL` | GitHub Enterprise Cloud with data residency: `https://copilot-api.<your-subdomain>.ghe.com/mcp` |
| `GITHUB_HOST` | Docker variant only: GitHub Enterprise Server URL, e.g. `https://github.example.com` |

## Config guide

```bash
wirebay add github to all                 # remote server (default)
wirebay add github --variant docker       # local Docker image instead
```

How each variant runs:

- **Remote (default):** `npx mcp-remote https://api.githubcopilot.com/mcp/` with an `Authorization`
  header that the launcher fills in from the environment (the token is never on the command line).
  `GITHUB_TOOLSETS` is sent as the `X-MCP-Toolsets` header.
- **Docker:** `docker run -i --rm -e GITHUB_PERSONAL_ACCESS_TOKEN -e GITHUB_TOOLSETS -e GITHUB_HOST ghcr.io/github/github-mcp-server:v1.12.2`

To pin a different image version or change arguments, create `~/.wirebay/servers/github.json` with
only the fields to override (see [custom servers](custom-servers.md#overriding-a-preset)).

What ends up in a tool config (Cursor example):

```json
"github": { "command": "/usr/local/bin/node", "args": ["/usr/local/lib/node_modules/wirebay/dist/cli.js", "run", "github"] }
```

## Verify

```bash
wirebay doctor github
```

Expect `MCP handshake … github-mcp-server … N tools`. Then ask your AI tool:
*"List my open pull requests in <owner>/<repo>."*

## Troubleshooting

| Symptom | Fix |
|---|---|
| `the server rejected the credentials (HTTP 401)` | The token is wrong, expired or not yet approved by the org. Create a new one and run `wirebay secrets set GITHUB_PERSONAL_ACCESS_TOKEN`. |
| `Incompatible auth server: does not support dynamic client registration` | Same as above: mcp-remote tried OAuth because the token was rejected. |
| Tools missing | Check `GITHUB_TOOLSETS`, and the token permissions for that area. |
| Docker variant: `Cannot find "docker"` | Start Docker Desktop, then run `wirebay init` again from a terminal where `docker` works. |

**Rotating the token:** create the new token, run `wirebay secrets set GITHUB_PERSONAL_ACCESS_TOKEN`,
restart the AI tool (or toggle the server), then delete the old token on GitHub.
