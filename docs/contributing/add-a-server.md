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
npm run new:server -- linear --npx @linear/mcp-server@1.2.3 --secret LINEAR_API_KEY --description "Linear: issues, projects, cycles"
```

This creates:
- `presets/linear.json`
- `docs/servers/linear.md` (from `templates/server-guide.md`)
- a section in `templates/secrets.env.example`

## 3. Fill in `presets/<name>.json`

```jsonc
{
  "name": "linear",
  "description": "Linear: issues, projects, cycles",
  "launch": { "type": "stdio", "command": "npx", "args": ["-y", "@linear/mcp-server@1.2.3"] },
  "secrets": [
    { "key": "LINEAR_API_KEY", "required": true, "description": "Personal API key",
      "pattern": "^lin_api_", "help": "https://github.com/VijayJaybhay/wirebay/blob/main/docs/servers/linear.md#1-create-a-token" }
  ],
  "env": { "LOG_LEVEL": "error" },          // non-secret defaults; may use ${VARS}
  "prereqs": ["npx"],
  "docs": "https://…official docs…",
  "guide": "docs/servers/linear.md",
  "lastVerified": "2026-09-25",
  "status": "beta"
}
```

Rules, all checked by `npm run validate`:
- Pin versions. `@latest` isn't allowed in presets.
- The file name matches `name`, and the name can't clash with a tool name or a reserved word.
- No real tokens anywhere. `pattern` helps users spot mistakes without ever printing the value.
- Remote servers: `{ "type": "remote", "url": "…", "auth": { "type": "bearer", "secret": "KEY" } }`.
  Optional variables in args: `{ "optional": ["--flag", "${VAR}"] }`.

## 4. Write the guide

`docs/servers/<name>.md` keeps the six sections: *What it gives you* (with a **Risk** note),
*Setup guide* (step-by-step credential creation), *Secrets*, *Config guide*, *Verify*,
*Troubleshooting* (including rotation).

## 5. Check the secrets template

The new section in `templates/secrets.env.example` should have a one-line comment per key saying
where to get it.

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
