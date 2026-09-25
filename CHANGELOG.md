# Changelog

All notable changes are recorded here by [Changesets](https://github.com/changesets/changesets).

## 0.1.0

First release.

- `wirebay run`: a launcher that injects only the declared secrets from `~/.wirebay/secrets.env`,
  and bridges remote servers through mcp-remote without putting tokens in argv.
- Commands: `init`, `add`, `sync`, `export`, `enable`, `disable`, `remove`, `unsync`, `list`,
  `tools`, `presets`, `secrets`, `doctor`, `restore`.
- Flexible command grammar (`sync github to codex`, `push all`, `rm github from cursor`) with
  did-you-mean suggestions.
- Presets: GitHub, Netlify, Firebase, AWS API, AWS Documentation.
- Tools directory: Claude Code, Claude Desktop, Codex, Cursor, VS Code, Gemini CLI.
- Comment-preserving edits for JSON/JSONC, TOML (managed block) and YAML, with backups, drift and
  conflict detection.
