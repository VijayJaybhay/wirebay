---
name: add-mcp-server
description: Add a new built-in MCP server preset to wirebay (presets/<name>.json + docs/servers/<name>.md + secrets template). Use when asked to "add/support a new MCP server", "add a preset for X", or "make wirebay work with the X MCP".
---

# Add an MCP server preset to wirebay

The canonical steps are in `docs/contributing/add-a-server.md`. Read that file first and follow it
exactly. This skill adds the agent-specific parts.

## Steps

1. **Research from official sources only.** Use WebFetch/WebSearch on the server's official repo
   or docs, and record the URL in the preset's `docs` field. Collect:
   - the package or image and the **latest version to pin** (`npm view <pkg> version`, the PyPI
     JSON API, registry tags)
   - the transport, the start command and its args
   - which env vars are secrets and which are plain settings
   - how to create the credential with least privilege
   - risky capabilities
2. **Scaffold:** `npm run new:server -- <name> [--npx pkg@ver | --uvx pkg@ver | --url https://…] --secret KEY … --description "…"`
3. **Fill in** `presets/<name>.json`, `docs/servers/<name>.md` (all six sections, including a **Risk**
   note) and the new section in `templates/secrets.env.example`.
4. **Verify:**
   ```bash
   npm run gen:docs && npm run validate && npm test
   ```
   Then run a sandboxed try:
   ```bash
   WIREBAY_USER_HOME=<tmp> WIREBAY_HOME=<tmp>/.wirebay node src/cli.ts add <name> to cursor --include-missing --no-prompt
   ```
   If the user can provide a test credential, run `doctor <name>` in the sandbox with it.
5. **Changeset:** create `.changeset/<name>-preset.md` with a `minor` bump for `wirebay`.
6. **Report** what you verified and what you couldn't (for example "handshake not run: no token").

## Hard rules

- Never write real tokens anywhere. Use key names only; the `pattern` field is for format hints.
- Never touch the user's real `~/.wirebay` or tool configs. Always use a temp `WIREBAY_HOME` and
  `WIREBAY_USER_HOME`.
- Pin versions (no `@latest`). `npm run validate` enforces this.
- The name must not clash with tool names or aliases (`validate` checks this).
