<h1 align="center">wirebay</h1>

<p align="center">
  <b>Define your MCP servers once. Keep every token in one place. Sync them to every AI coding tool.</b>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/wirebay"><img alt="npm" src="https://img.shields.io/npm/v/wirebay?color=cb3837"></a>
  <a href="https://github.com/VijayJaybhay/wirebay/actions/workflows/ci.yml"><img alt="CI" src="https://github.com/VijayJaybhay/wirebay/actions/workflows/ci.yml/badge.svg"></a>
  <img alt="Node" src="https://img.shields.io/badge/node-%3E%3D24-339933">
  <a href="https://github.com/VijayJaybhay/wirebay/blob/main/LICENSE"><img alt="License: MIT" src="https://img.shields.io/badge/license-MIT-blue"></a>
</p>

Claude Code, Claude Desktop, Codex, Cursor, VS Code, Gemini CLI, Windsurf, Zed, Kiro and a dozen more AI tools each keep MCP servers in
their own file, in their own format, and usually with your tokens pasted into every one of them.
**wirebay** gives you one list of servers, one private secrets file, and one command to wire them
into every tool:

```console
$ wirebay add github to all
✓ enabled github for claude-code, claude-desktop, codex, cursor, gemini, vscode
◆ github needs GITHUB_PERSONAL_ACCESS_TOKEN (Fine-grained personal access token)
│ ••••••••••••••••••••••••••••••••
✓ saved GITHUB_PERSONAL_ACCESS_TOKEN (gith…9f2c)
✓ Claude Code      ~/.claude.json                  + github
✓ Claude Desktop   …/Claude/claude_desktop_config.json   + github
✓ Codex            ~/.codex/config.toml            + github
✓ Cursor           ~/.cursor/mcp.json              + github
…
Restart to pick up the changes: Claude Desktop, Gemini CLI
```

## Why wirebay

- **No tokens in tool configs.** Every entry wirebay writes runs `wirebay run <server>`. At start-up,
  that launcher reads `~/.wirebay/secrets.env` and passes the server only the keys it declares.
  If you rotate a token, every tool picks it up on its next start without a re-sync.
- **Your existing config is safe.** wirebay only touches entries it created. Comments and
  formatting are kept, every file is backed up before it is written, and entries you edit by
  hand are flagged instead of being overwritten.
- **Commands that read like sentences.** `wirebay sync github to cursor`, `wirebay push all`,
  `wirebay rm netlify from desktop`. If you mistype, wirebay suggests the right word.
- **A maintained directory of tools and servers.** Each one has a setup guide, and adding a new
  one is usually just JSON and Markdown.

## Install

```bash
npm install -g wirebay     # recommended: tool configs point at a stable path
```

This needs **Node.js 24+**. Some servers have extra requirements: the AWS servers need
[uv](https://docs.astral.sh/uv/) (`uvx`), and the GitHub `docker` variant needs Docker.
You can also try wirebay without installing (`npx wirebay …`), but a global install is more robust.

## Quick start

```bash
wirebay init                   # creates ~/.wirebay and detects installed tools
wirebay add github to all      # asks for the token, then syncs to every detected tool
wirebay doctor                 # starts each server once and checks the MCP handshake
```

Then restart the tools that wirebay lists. That's it.

## Common recipes

```bash
wirebay presets                                   # built-in servers
wirebay add netlify to codex cursor               # only some tools
wirebay add linear --npx @linear/mcp-server --secret LINEAR_API_KEY --to claude
wirebay add sentry --url https://mcp.sentry.dev/mcp --oauth
wirebay sync                                      # make every tool match your config
wirebay sync --dry-run                            # show the exact diff first
wirebay list                                      # what is synced where
wirebay remove github from cursor                 # one tool
wirebay remove github                             # everywhere
wirebay secrets set NETLIFY_PERSONAL_ACCESS_TOKEN # rotate a token (asked for, never echoed)
wirebay sync --scope project                      # team-shareable .mcp.json / .vscode/mcp.json
wirebay unsync all                                # take everything wirebay added back out
```

## Supported servers

<!-- generated:servers -->
| Category | Server | What it does | Auth | Guide |
|---|---|---|---|---|
| ai | **huggingface** | Hugging Face: search models, datasets, papers and Spaces | none | [guide](https://github.com/VijayJaybhay/wirebay/blob/main/docs/servers/catalog.md#huggingface) |
| ai | **memory** | Memory: persistent knowledge-graph memory across sessions (MCP reference server) | optional | [guide](https://github.com/VijayJaybhay/wirebay/blob/main/docs/servers/catalog.md#memory) |
| ai | **sequential-thinking** | Sequential Thinking: structured step-by-step reasoning tool (MCP reference server) | none | [guide](https://github.com/VijayJaybhay/wirebay/blob/main/docs/servers/catalog.md#sequential-thinking) |
| browser | **chrome-devtools** | Chrome DevTools: inspect and debug live Chrome (performance, network, console) | none | [guide](https://github.com/VijayJaybhay/wirebay/blob/main/docs/servers/catalog.md#chrome-devtools) |
| browser | **playwright** | Playwright: automate a real browser via accessibility snapshots (Microsoft) | optional | [guide](https://github.com/VijayJaybhay/wirebay/blob/main/docs/servers/catalog.md#playwright) |
| cloud | **aws-api** | AWS API: run AWS CLI commands through MCP (read-only by default) | token | [guide](https://github.com/VijayJaybhay/wirebay/blob/main/docs/servers/aws.md) |
| cloud | **aws-docs** | AWS Documentation: search and read official AWS docs (no credentials needed) | none | [guide](https://github.com/VijayJaybhay/wirebay/blob/main/docs/servers/aws.md) |
| cloud | **azure** | Azure: work with 45+ Azure services using your Azure login (read-only by default) | optional | [guide](https://github.com/VijayJaybhay/wirebay/blob/main/docs/servers/catalog.md#azure) |
| cloud | **cloudflare** | Cloudflare API: the whole Cloudflare API via search/execute tools | browser login | [guide](https://github.com/VijayJaybhay/wirebay/blob/main/docs/servers/catalog.md#cloudflare) |
| cloud | **cloudflare-docs** | Cloudflare Docs: search Cloudflare documentation (no login needed) | none | [guide](https://github.com/VijayJaybhay/wirebay/blob/main/docs/servers/catalog.md#cloudflare-docs) |
| cloud | **firebase** | Firebase: projects, Auth, Firestore, Data Connect, Storage, Remote Config, Crashlytics | optional | [guide](https://github.com/VijayJaybhay/wirebay/blob/main/docs/servers/firebase.md) |
| cloud | **heroku** | Heroku: apps, dynos, add-ons and Postgres | browser login | [guide](https://github.com/VijayJaybhay/wirebay/blob/main/docs/servers/catalog.md#heroku) |
| cloud | **kubernetes** | Kubernetes: pods, resources and Helm via your kubeconfig (containers/kubernetes-mcp-server) | optional | [guide](https://github.com/VijayJaybhay/wirebay/blob/main/docs/servers/catalog.md#kubernetes) |
| cloud | **netlify** | Netlify: sites, deploys, environment variables, forms, extensions | token | [guide](https://github.com/VijayJaybhay/wirebay/blob/main/docs/servers/netlify.md) |
| cloud | **render** | Render: services, deploys, logs, metrics and Postgres queries | token | [guide](https://github.com/VijayJaybhay/wirebay/blob/main/docs/servers/catalog.md#render) |
| cloud | **terraform** | Terraform: Registry lookups and HCP Terraform workspaces (HashiCorp); runs disabled by default | optional | [guide](https://github.com/VijayJaybhay/wirebay/blob/main/docs/servers/catalog.md#terraform) |
| cloud | **vercel** | Vercel: docs, projects, deployments and logs | browser login | [guide](https://github.com/VijayJaybhay/wirebay/blob/main/docs/servers/catalog.md#vercel) |
| code-hosting | **github** | GitHub: repositories, issues, pull requests, Actions, code security | token | [guide](https://github.com/VijayJaybhay/wirebay/blob/main/docs/servers/github.md) |
| code-hosting | **gitlab** | GitLab: issues, merge requests, CI pipelines and repositories | browser login | [guide](https://github.com/VijayJaybhay/wirebay/blob/main/docs/servers/catalog.md#gitlab) |
| databases | **mongodb** | MongoDB: query databases and manage Atlas (read-only by default) | optional | [guide](https://github.com/VijayJaybhay/wirebay/blob/main/docs/servers/catalog.md#mongodb) |
| databases | **neon** | Neon: serverless Postgres projects, branches, SQL and migrations (read-only by default) | browser login | [guide](https://github.com/VijayJaybhay/wirebay/blob/main/docs/servers/catalog.md#neon) |
| databases | **postgres** | PostgreSQL (Postgres MCP Pro): query, explain and tune; restricted (read-only) by default | token | [guide](https://github.com/VijayJaybhay/wirebay/blob/main/docs/servers/catalog.md#postgres) |
| databases | **supabase** | Supabase: SQL, migrations, branches, edge functions and docs (read-only by default) | browser login | [guide](https://github.com/VijayJaybhay/wirebay/blob/main/docs/servers/catalog.md#supabase) |
| databases | **upstash** | Upstash: manage Redis, QStash and Workflow resources | 2 keys | [guide](https://github.com/VijayJaybhay/wirebay/blob/main/docs/servers/catalog.md#upstash) |
| dev-tools | **context7** | Context7: up-to-date library documentation and code examples for LLMs | optional | [guide](https://github.com/VijayJaybhay/wirebay/blob/main/docs/servers/catalog.md#context7) |
| dev-tools | **docker** | Docker MCP Toolkit gateway: one entry point to containerized catalog servers | optional | [guide](https://github.com/VijayJaybhay/wirebay/blob/main/docs/servers/catalog.md#docker) |
| dev-tools | **git** | Git: read and operate on a local git repository (MCP reference server) | optional | [guide](https://github.com/VijayJaybhay/wirebay/blob/main/docs/servers/catalog.md#git) |
| dev-tools | **postman** | Postman: collections, workspaces and API specs (minimal toolset by default) | browser login | [guide](https://github.com/VijayJaybhay/wirebay/blob/main/docs/servers/catalog.md#postman) |
| dev-tools | **shopify-dev** | Shopify Dev: Shopify docs, GraphQL schemas and code validation (no store access) | none | [guide](https://github.com/VijayJaybhay/wirebay/blob/main/docs/servers/catalog.md#shopify-dev) |
| observability | **sentry** | Sentry: errors, issues, traces and Seer root-cause analysis | browser login | [guide](https://github.com/VijayJaybhay/wirebay/blob/main/docs/servers/catalog.md#sentry) |
| payments | **paypal** | PayPal: invoices, orders and payments (sandbox by default) | browser login | [guide](https://github.com/VijayJaybhay/wirebay/blob/main/docs/servers/catalog.md#paypal) |
| payments | **stripe** | Stripe: payments API and docs search (prefer a sandbox) | browser login | [guide](https://github.com/VijayJaybhay/wirebay/blob/main/docs/servers/catalog.md#stripe) |
| productivity | **atlassian** | Atlassian Rovo: Jira, Confluence, Jira Service Management, Bitbucket | browser login | [guide](https://github.com/VijayJaybhay/wirebay/blob/main/docs/servers/catalog.md#atlassian) |
| productivity | **linear** | Linear: issues, projects, cycles and comments | browser login | [guide](https://github.com/VijayJaybhay/wirebay/blob/main/docs/servers/catalog.md#linear) |
| productivity | **notion** | Notion: search, read and edit pages and databases | browser login | [guide](https://github.com/VijayJaybhay/wirebay/blob/main/docs/servers/catalog.md#notion) |
| search | **brave-search** | Brave Search: web, news, image and local search | token | [guide](https://github.com/VijayJaybhay/wirebay/blob/main/docs/servers/catalog.md#brave-search) |
| search | **exa** | Exa: AI web search and page fetching | none | [guide](https://github.com/VijayJaybhay/wirebay/blob/main/docs/servers/catalog.md#exa) |
| search | **firecrawl** | Firecrawl: scrape, crawl, search and extract web data | token | [guide](https://github.com/VijayJaybhay/wirebay/blob/main/docs/servers/catalog.md#firecrawl) |
| search | **perplexity** | Perplexity: search, ask, research and reasoning | token | [guide](https://github.com/VijayJaybhay/wirebay/blob/main/docs/servers/catalog.md#perplexity) |
| search | **tavily** | Tavily: search, extract and crawl for agents | token | [guide](https://github.com/VijayJaybhay/wirebay/blob/main/docs/servers/catalog.md#tavily) |
| utilities | **fetch** | Fetch: download web pages and convert them to markdown (MCP reference server) | none | [guide](https://github.com/VijayJaybhay/wirebay/blob/main/docs/servers/catalog.md#fetch) |
| utilities | **filesystem** | Filesystem: read, write and search files inside an allowed folder (MCP reference server) | token | [guide](https://github.com/VijayJaybhay/wirebay/blob/main/docs/servers/catalog.md#filesystem) |
| utilities | **time** | Time: current time and timezone conversion (MCP reference server) | optional | [guide](https://github.com/VijayJaybhay/wirebay/blob/main/docs/servers/catalog.md#time) |
<!-- /generated:servers -->

Full details for every server, with setup notes and risk notes, are in the [server catalog](https://github.com/VijayJaybhay/wirebay/blob/main/docs/servers/catalog.md). `wirebay presets <word>` searches them.

Any other MCP server works too: use `wirebay add <name> --npx <package>`, `--uvx`, `--docker`, `--url` or `--command`.
See [custom servers](https://github.com/VijayJaybhay/wirebay/blob/main/docs/servers/custom-servers.md).

## Supported tools

<!-- generated:tools -->
| Tool | Name in commands | Scopes | Last verified | Guide |
|---|---|---|---|---|
| **Augment Code CLI (auggie)** | `auggie` `augment` `augment-code` | user | 2026-09-25 | [guide](https://github.com/VijayJaybhay/wirebay/blob/main/tools/auggie/GUIDE.md) |
| **Claude Code** | `claude-code` `claude` `cc` | user, project | 2026-09-25 | [guide](https://github.com/VijayJaybhay/wirebay/blob/main/tools/claude-code/GUIDE.md) |
| **Claude Desktop** | `claude-desktop` `desktop` `claude-app` | user | 2026-09-25 | [guide](https://github.com/VijayJaybhay/wirebay/blob/main/tools/claude-desktop/GUIDE.md) |
| **Cline (VS Code extension and CLI)** | `cline` `claude-dev` | user | 2026-09-25 | [guide](https://github.com/VijayJaybhay/wirebay/blob/main/tools/cline/GUIDE.md) |
| **OpenAI Codex (CLI, IDE extension and desktop app)** | `codex` `codex-cli` `codex-desktop` | user | 2026-09-25 | [guide](https://github.com/VijayJaybhay/wirebay/blob/main/tools/codex/GUIDE.md) |
| **Continue** | `continue` `continue-dev` | project | 2026-09-25 | [guide](https://github.com/VijayJaybhay/wirebay/blob/main/tools/continue/GUIDE.md) |
| **GitHub Copilot CLI** | `copilot-cli` `copilot` `gh-copilot` | user, project | 2026-09-25 | [guide](https://github.com/VijayJaybhay/wirebay/blob/main/tools/copilot-cli/GUIDE.md) |
| **Cursor** | `cursor` | user, project | 2026-09-25 | [guide](https://github.com/VijayJaybhay/wirebay/blob/main/tools/cursor/GUIDE.md) |
| **Gemini CLI** | `gemini` `gemini-cli` | user, project | 2026-09-25 | [guide](https://github.com/VijayJaybhay/wirebay/blob/main/tools/gemini/GUIDE.md) |
| **Goose** | `goose` `block-goose` | user | 2026-09-25 | [guide](https://github.com/VijayJaybhay/wirebay/blob/main/tools/goose/GUIDE.md) |
| **JetBrains Junie (IDE plugin and CLI)** | `junie` `jetbrains-junie` `jetbrains` | user, project | 2026-09-25 | [guide](https://github.com/VijayJaybhay/wirebay/blob/main/tools/junie/GUIDE.md) |
| **Kiro (IDE and Kiro CLI, formerly Amazon Q Developer CLI)** | `kiro` `kiro-cli` `amazon-q` `q-cli` | user, project | 2026-09-25 | [guide](https://github.com/VijayJaybhay/wirebay/blob/main/tools/kiro/GUIDE.md) |
| **LM Studio** | `lm-studio` `lmstudio` | user | 2026-09-25 | [guide](https://github.com/VijayJaybhay/wirebay/blob/main/tools/lm-studio/GUIDE.md) |
| **opencode** | `opencode` `open-code` `sst-opencode` | user, project | 2026-09-25 | [guide](https://github.com/VijayJaybhay/wirebay/blob/main/tools/opencode/GUIDE.md) |
| **Trae** | `trae` `trae-ide` `traecode` | project | 2026-09-25 | [guide](https://github.com/VijayJaybhay/wirebay/blob/main/tools/trae/GUIDE.md) |
| **Visual Studio Code (GitHub Copilot agent mode)** | `vscode` `code` `vs-code` | user, project | 2026-09-25 | [guide](https://github.com/VijayJaybhay/wirebay/blob/main/tools/vscode/GUIDE.md) |
| **Warp** | `warp` `warp-terminal` | user, project | 2026-09-25 | [guide](https://github.com/VijayJaybhay/wirebay/blob/main/tools/warp/GUIDE.md) |
| **Windsurf / Devin Desktop (Cascade)** | `windsurf` `devin-desktop` `cascade` `codeium` | user | 2026-09-25 | [guide](https://github.com/VijayJaybhay/wirebay/blob/main/tools/windsurf/GUIDE.md) |
| **Zed** | `zed` `zed-editor` | user, project | 2026-09-25 | [guide](https://github.com/VijayJaybhay/wirebay/blob/main/tools/zed/GUIDE.md) |
<!-- /generated:tools -->

## How it works

```
 ~/.wirebay/config.json ──(wirebay sync)──▶  tool configs (no secrets)
   "github → codex, cursor"                   { "command": "node", "args": [".../wirebay", "run", "github"] }
                                                              │
                                   tool starts the server     ▼
 ~/.wirebay/secrets.env ──────────────────▶  wirebay run github ──▶ real MCP server
   GITHUB_PERSONAL_ACCESS_TOKEN=…            (only github's keys)     (npx / uvx / docker / remote)
```

Read more in [concepts](https://github.com/VijayJaybhay/wirebay/blob/main/docs/concepts.md) and
[architecture](https://github.com/VijayJaybhay/wirebay/blob/main/docs/architecture.md).

## Security in brief

- Secrets live in `~/.wirebay/secrets.env`, which is readable only by you (`chmod 600` or a
  Windows ACL) and checked by `wirebay doctor`.
- Values are never printed in full or written to tool configs, logs, diffs or exports. The token
  for a remote server is passed through the environment, not the command line.
- Each tool file is backed up to `~/.wirebay/backups/` before every write (`wirebay restore <tool>`).
- wirebay makes no network calls of its own and collects no telemetry.

Details: [security model](https://github.com/VijayJaybhay/wirebay/blob/main/docs/security.md).

## Documentation

[Getting started](https://github.com/VijayJaybhay/wirebay/blob/main/docs/getting-started.md) ·
[CLI reference](https://github.com/VijayJaybhay/wirebay/blob/main/docs/cli-reference.md) ·
[Command grammar](https://github.com/VijayJaybhay/wirebay/blob/main/docs/command-grammar.md) ·
[Secrets](https://github.com/VijayJaybhay/wirebay/blob/main/docs/secrets.md) ·
[Teams & project scope](https://github.com/VijayJaybhay/wirebay/blob/main/docs/teams.md) ·
[Troubleshooting](https://github.com/VijayJaybhay/wirebay/blob/main/docs/troubleshooting.md) ·
[FAQ](https://github.com/VijayJaybhay/wirebay/blob/main/docs/faq.md) ·
[All docs](https://github.com/VijayJaybhay/wirebay/blob/main/docs/README.md)

## Contributing in 5 minutes

Most contributions are just **JSON and Markdown**:

- **Add a tool** (Windsurf, Zed, …): `npm run new:tool -- <id>`, then fill in `tools/<id>/tool.json` and `GUIDE.md`.
- **Add a server preset:** `npm run new:server -- <name> --npx <package@version> --secret KEY`.
- **Report a tool that changed its config format:** open a *config changed* issue.

See [CONTRIBUTING.md](https://github.com/VijayJaybhay/wirebay/blob/main/CONTRIBUTING.md). Everyone is welcome.

## Uninstall

```bash
wirebay unsync all     # remove every entry wirebay added (backups are kept)
npm rm -g wirebay
# optionally delete ~/.wirebay (this deletes your secrets file)
```

## License

[MIT](https://github.com/VijayJaybhay/wirebay/blob/main/LICENSE)
