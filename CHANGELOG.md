# Changelog

All notable changes are recorded here by [Changesets](https://github.com/changesets/changesets).

## 0.4.0

### Minor Changes

- 81b8b73: Tools that read other tools' MCP configs, and safer writes:
  
  - **Fix:** wirebay no longer writes Visual Studio's global `%USERPROFILE%\.mcp.json` for `all` or the default tools. Claude Code also reads `.mcp.json` from parent folders and reported `Missing "mcpServers" — found "servers" instead`. That file is now opt-in (written only when you name `visual-studio`), and `wirebay doctor --fix` removes wirebay's entries from an existing one.
  - **Know who reads what:** manifests now record which tools also read other tools' files (`alsoReads`, with official sources): Devin imports Claude Code's and Cursor's configs, VS Code reads a workspace `.mcp.json` and Copilot CLI's file, and so on. wirebay still writes every tool's own file and tells you when a server may appear twice: after `sync`, in `wirebay list`, and in the new `wirebay tools <tool>`.
  - **`wirebay doctor --fix`** (with `--yes` / `--dry-run`) repairs files that break another tool and brings out-of-date entries in line.
  - **Cleaner files:** wirebay deletes a config file it created once the last server is removed from it (with a backup), and checks every write by reading it back, restoring the previous file if anything is off.
  - **Home folder:** it is never used as a project (project files there are your global files).
  - **Faster remote servers:** remote servers start the bundled `mcp-remote` directly instead of through `npx`, so tools with short start-up limits (Claude Code "Request timed out") connect reliably.
  - **Manifest fixes from current docs:**
    - Cursor entries include `"type": "stdio"`.
    - Codex gets a project scope (`.codex/config.toml`).
    - Amp uses the right Windows path.
    - Continue gets a global folder.
    - Tabnine and Amp are marked as expanding `${VAR}`.
    - Visual Studio is no longer detected just because `~/.mcp.json` exists.

## 0.3.0

### Minor Changes

- 056be0e: Friendlier setup and feedback:
  
  - `wirebay add` explains every token a server needs: what it is and how to get it (steps or a link), says when a server signs in through the browser instead, and ends with the exact commands to set what is still missing. Placeholders in `secrets.env` carry the same how-to-get-it comment. Every required key of every preset now has this guidance, and `npm run validate` enforces it.
  - `wirebay secrets edit` (or `secrets open`) opens the secrets file in your editor (Notepad on Windows, the default text editor on macOS). When you close it, wirebay lists which keys changed, which required keys are still missing, and which tools to restart. No sync is needed.
  - Slow steps show a progress line in interactive terminals: starting servers in `wirebay doctor`, and updating each tool during `add`, `sync`, `enable`, `disable`, `remove` and `unsync`. Nothing extra is printed in CI, pipes or `--json` output.

## 0.2.0

First release on npm, as **`@pragnalabs.ai/wirebay`** (install: `npm install -g @pragnalabs.ai/wirebay`; the command is still `wirebay`).

### Minor Changes

- 2908b84: Add 13 tools (Windsurf/Devin Desktop, Cline, Kiro + Kiro CLI, GitHub Copilot CLI, Zed, opencode, Goose, Continue, JetBrains Junie, Augment auggie, Trae, Warp, LM Studio) and 38 server presets (Context7, Playwright, Chrome DevTools, reference servers, Supabase, Neon, MongoDB, Postgres, Docker, Azure, Terraform, Kubernetes, Sentry, Linear, Notion, Atlassian, Stripe, PayPal, Vercel, Heroku, Render, Cloudflare, GitLab, Brave, Exa, Firecrawl, Tavily, Perplexity, Hugging Face, Postman, Upstash, Shopify Dev). Presets now have categories, a generated server catalog, and `wirebay presets <search>`.
- 714c3ba: Rewrite the codebase as documented TypeScript classes (Command, Strategy, Template Method, Factory and Registry patterns, an `AppContext` composition root) with TSDoc on every public API and `npm run docs:api`. Add 14 popular servers found by live research (Grafana, Datadog, Storybook, Browser Use, MCP Toolbox for Databases, Serena, Zapier, Desktop Commander, Apify, Next.js DevTools, MobileBuildMCP, Mobile MCP, Microsoft Learn, Azure DevOps) and 11 more tools (Google Antigravity, Qwen Code, Amp, Factory Droid, Kilo Code, Visual Studio, Kimi Code, OpenHands, Rovo Dev, Qoder, Tabnine). Windsurf is now the `devin` tool (Devin CLI and Devin Desktop share one file).
- f7ffcaa: Project-level MCP servers: add, sync, list, enable, disable, remove, unsync and export now take `--global` (default), `--project`, or `--dir <path>` to apply servers to one project's tool configs (`.mcp.json`, `.cursor/mcp.json`, `.vscode/mcp.json`, …) instead of globally. A project's servers are kept in a committable `<project>/.wirebay.json` (validated against `schemas/project.schema.json`), found from any subfolder. `wirebay init --project` creates it. Inside a project, `sync` and `list` cover both global and project servers. Tools without project-level config are skipped with a hint.

### Patch Changes

- a69a2b3: Adopt a zero-findings code quality policy: strict type-aware ESLint, Prettier formatting, stricter TypeScript checks, pre-commit and pre-push hooks, and no suppression comments. All findings were fixed in the code.
- Fix `wirebay restore` silently doing nothing when the backup it restores was taken in the same millisecond: backups now get unique, ordered names.

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
