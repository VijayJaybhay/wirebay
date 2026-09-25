# Add a server preset

A preset lets anyone add a server by name: `wirebay add <name> to all`. It's JSON + Markdown.

## What makes a good preset

- An **official** or widely used, maintained MCP server
- Installable with `npx`, `uvx`, Docker, or reachable as a remote URL
- Clear credential instructions that can follow **least privilege**

## 1. Research

From the server's official README or docs, find:

- [ ] Package and **exact version** to pin (`npm view <pkg> version`, PyPI, image tag)
- [ ] How it starts (command and args) and its transport (stdio or remote HTTP)
- [ ] Required and optional environment variables; which are secrets
- [ ] How users create the credential, and the narrowest permissions that work
- [ ] Anything risky it can do (writes, deletes, spending money)

## 2. Scaffold

```bash
npm run new:server -- linear --npx @linear/mcp-server@1.2.3 --secret LINEAR_API_KEY --category productivity --description "Linear: issues, projects, cycles"
```

This creates `presets/linear.json`. Its documentation is generated into the
[server catalog](../servers/catalog.md) from the preset itself: description, variants, secrets
and `notes`.

Add `--guide` to also create a dedicated `docs/servers/<name>.md`. That is worth it for servers
with a complex setup, like GitHub or AWS.

## 3. Fill in `presets/<name>.json`

```jsonc
{
  "name": "linear",
  "description": "Linear: issues, projects, cycles",
  "launch": { "type": "stdio", "command": "npx", "args": ["-y", "@linear/mcp-server@1.2.3"] },
  "secrets": [
    {
      "key": "LINEAR_API_KEY",
      "required": true,
      "description": "Personal API key",
      "pattern": "^lin_api_",
      "help": "https://github.com/VijayJaybhay/wirebay/blob/main/docs/servers/linear.md#1-create-a-token",
    },
  ],
  "env": { "LOG_LEVEL": "error" }, // non-secret defaults; may use ${VARS}
  "prereqs": ["npx"],
  "docs": "https://…official docs…",
  "guide": "docs/servers/linear.md",
  "lastVerified": "2026-09-25",
  "status": "beta",
}
```

Rules, all checked by `npm run validate`:

- Pin versions. `@latest` isn't allowed in presets.
- The file name matches `name`, and the name can't clash with a tool name or a reserved word.
- No real tokens anywhere. `pattern` helps users spot mistakes without ever printing the value.
- Remote servers: `{ "type": "remote", "url": "…", "auth": { "type": "bearer", "secret": "KEY" } }`.
  Optional variables in args: `{ "optional": ["--flag", "${VAR}"] }`.

## 4. Describe it well

- Every secret gets a `description` (what it is). Where possible, also add `help` (a link to
  where it's created) and `pattern` (its prefix).
- `notes` holds risk notes (can it write, delete or spend money?) and setup tips. They are shown
  in the catalog.
- `category` groups it in `wirebay presets` and the README.

## 5. Keep values out

Never put real tokens in the preset. `npm run validate` checks for anything that looks like one.

## 6. Generate, validate, test

```bash
npm run gen:docs && npm run validate && npm test
export WIREBAY_USER_HOME=/tmp/wb WIREBAY_HOME=/tmp/wb/.wirebay
node src/cli.ts init && node src/cli.ts add linear to cursor --include-missing
node src/cli.ts doctor linear          # with a real (test) token: must pass the handshake
```

## 7. Open a PR

Add a changeset (`npx changeset`, minor for a new preset) and complete the checklist. Mention in the
PR which OS you tested the handshake on.
