@AGENTS.md

## Claude Code notes

- Project skills live in `.claude/skills/`:
  - `add-mcp-server`: add a built-in server preset
  - `add-mcp-client`: add a new AI tool to the tools directory
  - `update-tool-directory`: re-verify stale tools and presets against their official docs

  Each skill follows the matching guide in `docs/contributing/`.
- Never run `wirebay sync`/`add`/`remove` from source against the real home directory. Always set
  `WIREBAY_USER_HOME` and `WIREBAY_HOME` to a temp folder.
- For Claude Code's own user scope, wirebay goes through `claude mcp add-json -s user` and never
  edits `~/.claude.json` directly (see `src/adapters/overrides/claude-code.ts`).
