---
name: add-mcp-client
description: Add support for a new AI coding tool / MCP client (e.g. Windsurf, Zed, Cline, JetBrains) to wirebay's tools directory (tools/<id>/tool.json + GUIDE.md). Use when asked to "support tool X", "add X's MCP config", or "wirebay should sync to X".
---

# Add a new AI tool to wirebay

The canonical steps are in `docs/contributing/add-a-tool.md`. Read that file first and follow it
exactly. This skill adds the agent-specific parts.

## Steps

1. **Research from the tool's official docs** (WebFetch/WebSearch) and fill in the checklist from
   the guide:
   - config path per OS and per scope
   - format
   - root key
   - entry shape and extra fields
   - `.cmd` shim support on Windows
   - whether a restart is needed
   - a detection command or folder
   - how to verify inside the tool

   Record the docs URL in `docs.mcp`. If the sources disagree or something is unknown, say so and
   mark `"status": "beta"`.
2. **Scaffold:** `npm run new:tool -- <id> --name "<Name>" --path "<user config path>" [--format …] [--root-key …]`
3. **Fill in** `tools/<id>/tool.json` (aliases, both scopes if supported, per-OS paths, `entry`,
   `supports`, `restartRequired`) and `tools/<id>/GUIDE.md` (keep the template's sections).
4. **Only if the generic adapter can't express the tool**, add `src/adapters/overrides/<id>.ts`,
   register it in `src/adapters/index.ts`, and set `"adapter"`. Ask the user before writing code.
5. **Generate and verify:**
   ```bash
   npm run gen:docs && npm run validate && npm test
   node src/cli.ts tools verify <id>
   ```
   Then a sandboxed sync:
   ```bash
   WIREBAY_USER_HOME=<tmp> WIREBAY_HOME=<tmp>/.wirebay node src/cli.ts add aws-docs to <id> --include-missing --no-prompt
   ```
   Show the user the resulting file, plus the generated `examples/`.
6. **Changeset:** `.changeset/<id>-tool.md` with a `minor` bump.
7. **Report** what was verified against a real installation and what was only checked against docs.

## Hard rules

- Never edit the user's real tool configs while developing. Always use a temp `WIREBAY_USER_HOME`.
- The id and aliases must be unique and must not be reserved words (`validate` checks this).
- Don't guess paths. If the docs don't say, ask the user, or leave that scope out.
