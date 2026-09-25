# Changelog

All notable changes are recorded here by [Changesets](https://github.com/changesets/changesets).

## 0.2.0

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
