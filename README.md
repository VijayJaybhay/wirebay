<h1 align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/pragnalabs-ai/wirebay/main/assets/brand/wirebay_logo_dark.png">
    <img alt="wirebay" src="https://raw.githubusercontent.com/pragnalabs-ai/wirebay/main/assets/brand/wirebay_logo.png" width="420">
  </picture>
</h1>

<p align="center">
  <b>Define your MCP servers once. Keep every token in one place. Sync them to every AI coding tool.</b>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@pragnalabs.ai/wirebay"><img alt="npm" src="https://img.shields.io/npm/v/@pragnalabs.ai/wirebay?color=cb3837"></a>
  <a href="https://github.com/pragnalabs-ai/wirebay/actions/workflows/ci.yml"><img alt="CI" src="https://github.com/pragnalabs-ai/wirebay/actions/workflows/ci.yml/badge.svg"></a>
  <img alt="Node" src="https://img.shields.io/badge/node-%3E%3D24-339933">
  <a href="https://github.com/pragnalabs-ai/wirebay/blob/main/LICENSE"><img alt="License: MIT" src="https://img.shields.io/badge/license-MIT-blue"></a>
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

## Without vs with wirebay

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/pragnalabs-ai/wirebay/main/assets/diagrams/without-vs-with-dark.png">
    <img alt="Without wirebay, each tool has its own config file with a copy of your token. With wirebay, tokens live in one secrets file and wirebay sync writes token-free entries into every tool." src="https://raw.githubusercontent.com/pragnalabs-ai/wirebay/main/assets/diagrams/without-vs-with-light.png" width="900">
  </picture>
</p>

|                           | Without wirebay                                            | With wirebay                                                |
| ------------------------- | ---------------------------------------------------------- | ----------------------------------------------------------- |
| Where your tokens live    | Pasted into every tool's config file                       | One private file: `~/.wirebay/secrets.env`                  |
| Adding a server           | Learn each tool's file, format and key, then edit each one | `wirebay add github to all`                                 |
| Rotating a token          | Find and edit every file                                   | `wirebay secrets set KEY`; tools use it on their next start |
| What a server can see     | Whatever env you pasted into that entry                    | Only the keys that server declares                          |
| Committing project config | Risky: the file may hold a token                           | Safe: entries only say `wirebay run <server>`               |
| Your hand-written entries | Easy to break while editing                                | Never touched; comments and formatting kept, backups taken  |

The same GitHub server, before and after:

<table>
<tr><th>Before: <code>~/.cursor/mcp.json</code>, and 5 more files like it</th><th>After: what wirebay writes (no token)</th></tr>
<tr><td>

```json
{
  "mcpServers": {
    "github": {
      "command": "docker",
      "args": ["run", "-i", "--rm", "-e", "GITHUB_PERSONAL_ACCESS_TOKEN", "ghcr.io/github/github-mcp-server"],
      "env": {
        "GITHUB_PERSONAL_ACCESS_TOKEN": "ghp_xxxxxxxxxxxx"
      }
    }
  }
}
```

</td><td>

```json
{
  "mcpServers": {
    "github": {
      "command": "/usr/local/bin/node",
      "args": ["/usr/local/lib/node_modules/wirebay/dist/cli.js", "run", "github"]
    }
  }
}
```

</td></tr>
</table>

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

wirebay is a command-line tool, so install it **globally** (`-g`). That puts the `wirebay`
command on your PATH:

```bash
npm install -g "@pragnalabs.ai/wirebay"
wirebay --version
```

- **Keep the quotes.** Windows PowerShell treats a leading `@` as its own syntax and fails with
  _"The splatting operator '@' cannot be used…"_. The quoted name works in every shell (PowerShell,
  cmd, bash, zsh).
- **Don't use the `npm i @pragnalabs.ai/wirebay` line shown on npmjs.com.** npm shows that for
  every package. Without `-g` it installs wirebay as a library into the current folder, and the
  `wirebay` command is not found. To undo it: `npm uninstall "@pragnalabs.ai/wirebay"` in that folder.
- **`wirebay` not found after a global install?** Run `npm prefix -g` and make sure that folder
  (on Windows usually `%APPDATA%\npm`) is on your PATH, then open a new terminal.

Requirements: **Node.js 24+**. Some servers need more: the AWS servers need
[uv](https://docs.astral.sh/uv/) (`uvx`), and the GitHub `docker` variant needs Docker.

To try it without installing, use `npx "@pragnalabs.ai/wirebay" init`. A global install is still
recommended, because tool configs then point at a stable path.

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
wirebay add supabase to cursor claude --project  # this project only (saved in ./.wirebay.json)
wirebay add supabase to vscode --dir ~/code/app   # a project folder named explicitly
wirebay sync --project                            # re-create this project's tool files
wirebay unsync all                                # take everything wirebay added back out
```

## Supported servers

<!-- generated:servers -->

| Category      | Server                   | What it does                                                                                         | Auth          | Guide                                                                                                    |
| ------------- | ------------------------ | ---------------------------------------------------------------------------------------------------- | ------------- | -------------------------------------------------------------------------------------------------------- |
| ai            | **huggingface**          | Hugging Face: search models, datasets, papers and Spaces                                             | none          | [guide](https://github.com/pragnalabs-ai/wirebay/blob/main/docs/servers/catalog.md#huggingface)          |
| ai            | **memory**               | Memory: persistent knowledge-graph memory across sessions (MCP reference server)                     | optional      | [guide](https://github.com/pragnalabs-ai/wirebay/blob/main/docs/servers/catalog.md#memory)               |
| ai            | **sequential-thinking**  | Sequential Thinking: structured step-by-step reasoning tool (MCP reference server)                   | none          | [guide](https://github.com/pragnalabs-ai/wirebay/blob/main/docs/servers/catalog.md#sequential-thinking)  |
| browser       | **browser-use**          | Browser Use: autonomous browser agent (local, or the paid cloud service)                             | optional      | [guide](https://github.com/pragnalabs-ai/wirebay/blob/main/docs/servers/catalog.md#browser-use)          |
| browser       | **chrome-devtools**      | Chrome DevTools: inspect and debug live Chrome (performance, network, console)                       | none          | [guide](https://github.com/pragnalabs-ai/wirebay/blob/main/docs/servers/catalog.md#chrome-devtools)      |
| browser       | **playwright**           | Playwright: automate a real browser via accessibility snapshots (Microsoft)                          | optional      | [guide](https://github.com/pragnalabs-ai/wirebay/blob/main/docs/servers/catalog.md#playwright)           |
| cloud         | **aws-api**              | AWS API: run AWS CLI commands through MCP (read-only by default)                                     | token         | [guide](https://github.com/pragnalabs-ai/wirebay/blob/main/docs/servers/aws.md)                          |
| cloud         | **aws-docs**             | AWS Documentation: search and read official AWS docs (no credentials needed)                         | none          | [guide](https://github.com/pragnalabs-ai/wirebay/blob/main/docs/servers/aws.md)                          |
| cloud         | **azure**                | Azure: work with 45+ Azure services using your Azure login (read-only by default)                    | optional      | [guide](https://github.com/pragnalabs-ai/wirebay/blob/main/docs/servers/catalog.md#azure)                |
| cloud         | **cloudflare**           | Cloudflare API: the whole Cloudflare API via search/execute tools                                    | browser login | [guide](https://github.com/pragnalabs-ai/wirebay/blob/main/docs/servers/catalog.md#cloudflare)           |
| cloud         | **cloudflare-docs**      | Cloudflare Docs: search Cloudflare documentation (no login needed)                                   | none          | [guide](https://github.com/pragnalabs-ai/wirebay/blob/main/docs/servers/catalog.md#cloudflare-docs)      |
| cloud         | **firebase**             | Firebase: projects, Auth, Firestore, Data Connect, Storage, Remote Config, Crashlytics               | optional      | [guide](https://github.com/pragnalabs-ai/wirebay/blob/main/docs/servers/firebase.md)                     |
| cloud         | **heroku**               | Heroku: apps, dynos, add-ons and Postgres                                                            | browser login | [guide](https://github.com/pragnalabs-ai/wirebay/blob/main/docs/servers/catalog.md#heroku)               |
| cloud         | **kubernetes**           | Kubernetes: pods, resources and Helm via your kubeconfig (containers/kubernetes-mcp-server)          | optional      | [guide](https://github.com/pragnalabs-ai/wirebay/blob/main/docs/servers/catalog.md#kubernetes)           |
| cloud         | **netlify**              | Netlify: sites, deploys, environment variables, forms, extensions                                    | token         | [guide](https://github.com/pragnalabs-ai/wirebay/blob/main/docs/servers/netlify.md)                      |
| cloud         | **render**               | Render: services, deploys, logs, metrics and Postgres queries                                        | token         | [guide](https://github.com/pragnalabs-ai/wirebay/blob/main/docs/servers/catalog.md#render)               |
| cloud         | **terraform**            | Terraform: Registry lookups and HCP Terraform workspaces (HashiCorp); runs disabled by default       | optional      | [guide](https://github.com/pragnalabs-ai/wirebay/blob/main/docs/servers/catalog.md#terraform)            |
| cloud         | **vercel**               | Vercel: docs, projects, deployments and logs                                                         | browser login | [guide](https://github.com/pragnalabs-ai/wirebay/blob/main/docs/servers/catalog.md#vercel)               |
| code-hosting  | **azure-devops**         | Azure DevOps: work items, repos, pipelines and wikis                                                 | token         | [guide](https://github.com/pragnalabs-ai/wirebay/blob/main/docs/servers/catalog.md#azure-devops)         |
| code-hosting  | **github**               | GitHub: repositories, issues, pull requests, Actions, code security                                  | token         | [guide](https://github.com/pragnalabs-ai/wirebay/blob/main/docs/servers/github.md)                       |
| code-hosting  | **gitlab**               | GitLab: issues, merge requests, CI pipelines and repositories                                        | browser login | [guide](https://github.com/pragnalabs-ai/wirebay/blob/main/docs/servers/catalog.md#gitlab)               |
| databases     | **mcp-toolbox-postgres** | Google MCP Toolbox for Databases: prebuilt PostgreSQL tools                                          | 3 keys        | [guide](https://github.com/pragnalabs-ai/wirebay/blob/main/docs/servers/catalog.md#mcp-toolbox-postgres) |
| databases     | **mongodb**              | MongoDB: query databases and manage Atlas (read-only by default)                                     | optional      | [guide](https://github.com/pragnalabs-ai/wirebay/blob/main/docs/servers/catalog.md#mongodb)              |
| databases     | **neon**                 | Neon: serverless Postgres projects, branches, SQL and migrations (read-only by default)              | browser login | [guide](https://github.com/pragnalabs-ai/wirebay/blob/main/docs/servers/catalog.md#neon)                 |
| databases     | **postgres**             | PostgreSQL (Postgres MCP Pro): query, explain and tune; restricted (read-only) by default            | token         | [guide](https://github.com/pragnalabs-ai/wirebay/blob/main/docs/servers/catalog.md#postgres)             |
| databases     | **supabase**             | Supabase: SQL, migrations, branches, edge functions and docs (read-only by default)                  | browser login | [guide](https://github.com/pragnalabs-ai/wirebay/blob/main/docs/servers/catalog.md#supabase)             |
| databases     | **upstash**              | Upstash: manage Redis, QStash and Workflow resources                                                 | 2 keys        | [guide](https://github.com/pragnalabs-ai/wirebay/blob/main/docs/servers/catalog.md#upstash)              |
| dev-tools     | **context7**             | Context7: up-to-date library documentation and code examples for LLMs                                | optional      | [guide](https://github.com/pragnalabs-ai/wirebay/blob/main/docs/servers/catalog.md#context7)             |
| dev-tools     | **docker**               | Docker MCP Toolkit gateway: one entry point to containerized catalog servers                         | optional      | [guide](https://github.com/pragnalabs-ai/wirebay/blob/main/docs/servers/catalog.md#docker)               |
| dev-tools     | **git**                  | Git: read and operate on a local git repository (MCP reference server)                               | optional      | [guide](https://github.com/pragnalabs-ai/wirebay/blob/main/docs/servers/catalog.md#git)                  |
| dev-tools     | **microsoft-learn**      | Microsoft Learn: search and read official Microsoft/Azure/.NET docs and code samples                 | none          | [guide](https://github.com/pragnalabs-ai/wirebay/blob/main/docs/servers/catalog.md#microsoft-learn)      |
| dev-tools     | **mobile-mcp**           | Mobile MCP: automate iOS and Android simulators, emulators and devices                               | none          | [guide](https://github.com/pragnalabs-ai/wirebay/blob/main/docs/servers/catalog.md#mobile-mcp)           |
| dev-tools     | **mobilebuildmcp**       | MobileBuildMCP (formerly XcodeBuildMCP): Xcode builds, simulators, devices and UI automation (macOS) | none          | [guide](https://github.com/pragnalabs-ai/wirebay/blob/main/docs/servers/catalog.md#mobilebuildmcp)       |
| dev-tools     | **next-devtools**        | Next.js DevTools: errors, routes and logs from your running Next.js 16+ dev server (Vercel)          | none          | [guide](https://github.com/pragnalabs-ai/wirebay/blob/main/docs/servers/catalog.md#next-devtools)        |
| dev-tools     | **postman**              | Postman: collections, workspaces and API specs (minimal toolset by default)                          | browser login | [guide](https://github.com/pragnalabs-ai/wirebay/blob/main/docs/servers/catalog.md#postman)              |
| dev-tools     | **serena**               | Serena: language-server-powered code navigation and editing for the current project                  | none          | [guide](https://github.com/pragnalabs-ai/wirebay/blob/main/docs/servers/catalog.md#serena)               |
| dev-tools     | **shopify-dev**          | Shopify Dev: Shopify docs, GraphQL schemas and code validation (no store access)                     | none          | [guide](https://github.com/pragnalabs-ai/wirebay/blob/main/docs/servers/catalog.md#shopify-dev)          |
| dev-tools     | **storybook**            | Storybook: component docs, story authoring and tests from your running Storybook                     | none          | [guide](https://github.com/pragnalabs-ai/wirebay/blob/main/docs/servers/catalog.md#storybook)            |
| observability | **datadog**              | Datadog: logs, metrics, traces, monitors and incidents                                               | browser login | [guide](https://github.com/pragnalabs-ai/wirebay/blob/main/docs/servers/catalog.md#datadog)              |
| observability | **grafana**              | Grafana: dashboards, Prometheus/Loki queries, alerts and incidents (read-only by default)            | 2 keys        | [guide](https://github.com/pragnalabs-ai/wirebay/blob/main/docs/servers/catalog.md#grafana)              |
| observability | **sentry**               | Sentry: errors, issues, traces and Seer root-cause analysis                                          | browser login | [guide](https://github.com/pragnalabs-ai/wirebay/blob/main/docs/servers/catalog.md#sentry)               |
| payments      | **paypal**               | PayPal: invoices, orders and payments (sandbox by default)                                           | browser login | [guide](https://github.com/pragnalabs-ai/wirebay/blob/main/docs/servers/catalog.md#paypal)               |
| payments      | **stripe**               | Stripe: payments API and docs search (prefer a sandbox)                                              | browser login | [guide](https://github.com/pragnalabs-ai/wirebay/blob/main/docs/servers/catalog.md#stripe)               |
| productivity  | **atlassian**            | Atlassian Rovo: Jira, Confluence, Jira Service Management, Bitbucket                                 | browser login | [guide](https://github.com/pragnalabs-ai/wirebay/blob/main/docs/servers/catalog.md#atlassian)            |
| productivity  | **linear**               | Linear: issues, projects, cycles and comments                                                        | browser login | [guide](https://github.com/pragnalabs-ai/wirebay/blob/main/docs/servers/catalog.md#linear)               |
| productivity  | **notion**               | Notion: search, read and edit pages and databases                                                    | browser login | [guide](https://github.com/pragnalabs-ai/wirebay/blob/main/docs/servers/catalog.md#notion)               |
| productivity  | **zapier**               | Zapier: run actions in 9,000+ apps                                                                   | browser login | [guide](https://github.com/pragnalabs-ai/wirebay/blob/main/docs/servers/catalog.md#zapier)               |
| search        | **apify**                | Apify: run web scrapers (Actors) and read their results                                              | browser login | [guide](https://github.com/pragnalabs-ai/wirebay/blob/main/docs/servers/catalog.md#apify)                |
| search        | **brave-search**         | Brave Search: web, news, image and local search                                                      | token         | [guide](https://github.com/pragnalabs-ai/wirebay/blob/main/docs/servers/catalog.md#brave-search)         |
| search        | **exa**                  | Exa: AI web search and page fetching                                                                 | none          | [guide](https://github.com/pragnalabs-ai/wirebay/blob/main/docs/servers/catalog.md#exa)                  |
| search        | **firecrawl**            | Firecrawl: scrape, crawl, search and extract web data                                                | token         | [guide](https://github.com/pragnalabs-ai/wirebay/blob/main/docs/servers/catalog.md#firecrawl)            |
| search        | **perplexity**           | Perplexity: search, ask, research and reasoning                                                      | token         | [guide](https://github.com/pragnalabs-ai/wirebay/blob/main/docs/servers/catalog.md#perplexity)           |
| search        | **tavily**               | Tavily: search, extract and crawl for agents                                                         | token         | [guide](https://github.com/pragnalabs-ai/wirebay/blob/main/docs/servers/catalog.md#tavily)               |
| utilities     | **desktop-commander**    | Desktop Commander: terminal commands, file editing and process management (high risk)                | none          | [guide](https://github.com/pragnalabs-ai/wirebay/blob/main/docs/servers/catalog.md#desktop-commander)    |
| utilities     | **fetch**                | Fetch: download web pages and convert them to markdown (MCP reference server)                        | none          | [guide](https://github.com/pragnalabs-ai/wirebay/blob/main/docs/servers/catalog.md#fetch)                |
| utilities     | **filesystem**           | Filesystem: read, write and search files inside an allowed folder (MCP reference server)             | token         | [guide](https://github.com/pragnalabs-ai/wirebay/blob/main/docs/servers/catalog.md#filesystem)           |
| utilities     | **time**                 | Time: current time and timezone conversion (MCP reference server)                                    | optional      | [guide](https://github.com/pragnalabs-ai/wirebay/blob/main/docs/servers/catalog.md#time)                 |

<!-- /generated:servers -->

Full details for every server, with setup notes and risk notes, are in the [server catalog](https://github.com/pragnalabs-ai/wirebay/blob/main/docs/servers/catalog.md). `wirebay presets <word>` searches them.

Any other MCP server works too: use `wirebay add <name> --npx <package>`, `--uvx`, `--docker`, `--url` or `--command`.
See [custom servers](https://github.com/pragnalabs-ai/wirebay/blob/main/docs/servers/custom-servers.md).

## Supported tools

<!-- generated:tools -->

| Tool                                                         | Name in commands                                                   | Scopes        | Last verified | Guide                                                                                     |
| ------------------------------------------------------------ | ------------------------------------------------------------------ | ------------- | ------------- | ----------------------------------------------------------------------------------------- |
| **Amp (Sourcegraph)**                                        | `amp` `ampcode`                                                    | user, project | 2026-09-25    | [guide](https://github.com/pragnalabs-ai/wirebay/blob/main/tools/amp/GUIDE.md)            |
| **Google Antigravity**                                       | `antigravity` `google-antigravity`                                 | user, project | 2026-09-25    | [guide](https://github.com/pragnalabs-ai/wirebay/blob/main/tools/antigravity/GUIDE.md)    |
| **Augment Code CLI (auggie)**                                | `auggie` `augment` `augment-code`                                  | user          | 2026-09-25    | [guide](https://github.com/pragnalabs-ai/wirebay/blob/main/tools/auggie/GUIDE.md)         |
| **Claude Code**                                              | `claude-code` `claude` `cc`                                        | user, project | 2026-09-25    | [guide](https://github.com/pragnalabs-ai/wirebay/blob/main/tools/claude-code/GUIDE.md)    |
| **Claude Desktop**                                           | `claude-desktop` `desktop` `claude-app`                            | user          | 2026-09-25    | [guide](https://github.com/pragnalabs-ai/wirebay/blob/main/tools/claude-desktop/GUIDE.md) |
| **Cline (VS Code extension and CLI)**                        | `cline` `claude-dev`                                               | user          | 2026-09-25    | [guide](https://github.com/pragnalabs-ai/wirebay/blob/main/tools/cline/GUIDE.md)          |
| **OpenAI Codex (CLI, IDE extension and desktop app)**        | `codex` `codex-cli` `codex-desktop`                                | user          | 2026-09-25    | [guide](https://github.com/pragnalabs-ai/wirebay/blob/main/tools/codex/GUIDE.md)          |
| **Continue**                                                 | `continue` `continue-dev`                                          | project       | 2026-09-25    | [guide](https://github.com/pragnalabs-ai/wirebay/blob/main/tools/continue/GUIDE.md)       |
| **GitHub Copilot CLI**                                       | `copilot-cli` `copilot` `gh-copilot`                               | user, project | 2026-09-25    | [guide](https://github.com/pragnalabs-ai/wirebay/blob/main/tools/copilot-cli/GUIDE.md)    |
| **Cursor**                                                   | `cursor` `cursor-cli` `cursor-agent`                               | user, project | 2026-09-25    | [guide](https://github.com/pragnalabs-ai/wirebay/blob/main/tools/cursor/GUIDE.md)         |
| **Devin (Devin CLI and Devin Desktop / Windsurf Cascade)**   | `devin` `windsurf` `devin-cli` `devin-desktop` `cascade` `codeium` | user, project | 2026-09-25    | [guide](https://github.com/pragnalabs-ai/wirebay/blob/main/tools/devin/GUIDE.md)          |
| **Factory Droid**                                            | `factory-droid` `droid` `factory`                                  | user, project | 2026-09-25    | [guide](https://github.com/pragnalabs-ai/wirebay/blob/main/tools/factory-droid/GUIDE.md)  |
| **Gemini CLI**                                               | `gemini` `gemini-cli`                                              | user, project | 2026-09-25    | [guide](https://github.com/pragnalabs-ai/wirebay/blob/main/tools/gemini/GUIDE.md)         |
| **Goose**                                                    | `goose` `block-goose`                                              | user          | 2026-09-25    | [guide](https://github.com/pragnalabs-ai/wirebay/blob/main/tools/goose/GUIDE.md)          |
| **JetBrains Junie (IDE plugin and CLI)**                     | `junie` `jetbrains-junie` `jetbrains`                              | user, project | 2026-09-25    | [guide](https://github.com/pragnalabs-ai/wirebay/blob/main/tools/junie/GUIDE.md)          |
| **Kilo Code (extension and CLI)**                            | `kilo-code` `kilo` `kilocode`                                      | user, project | 2026-09-25    | [guide](https://github.com/pragnalabs-ai/wirebay/blob/main/tools/kilo-code/GUIDE.md)      |
| **Kimi Code CLI (Moonshot)**                                 | `kimi-code` `kimi`                                                 | user, project | 2026-09-25    | [guide](https://github.com/pragnalabs-ai/wirebay/blob/main/tools/kimi-code/GUIDE.md)      |
| **Kiro (IDE and Kiro CLI, formerly Amazon Q Developer CLI)** | `kiro` `kiro-cli` `amazon-q` `q-cli`                               | user, project | 2026-09-25    | [guide](https://github.com/pragnalabs-ai/wirebay/blob/main/tools/kiro/GUIDE.md)           |
| **LM Studio**                                                | `lm-studio` `lmstudio`                                             | user          | 2026-09-25    | [guide](https://github.com/pragnalabs-ai/wirebay/blob/main/tools/lm-studio/GUIDE.md)      |
| **opencode**                                                 | `opencode` `open-code` `sst-opencode`                              | user, project | 2026-09-25    | [guide](https://github.com/pragnalabs-ai/wirebay/blob/main/tools/opencode/GUIDE.md)       |
| **OpenHands CLI**                                            | `openhands` `open-hands`                                           | user          | 2026-09-25    | [guide](https://github.com/pragnalabs-ai/wirebay/blob/main/tools/openhands/GUIDE.md)      |
| **Qoder CLI**                                                | `qoder` `qodercli`                                                 | user          | 2026-09-25    | [guide](https://github.com/pragnalabs-ai/wirebay/blob/main/tools/qoder/GUIDE.md)          |
| **Qwen Code**                                                | `qwen-code` `qwen`                                                 | user, project | 2026-09-25    | [guide](https://github.com/pragnalabs-ai/wirebay/blob/main/tools/qwen-code/GUIDE.md)      |
| **Atlassian Rovo Dev CLI**                                   | `rovo-dev` `rovodev` `rovo`                                        | user          | 2026-09-25    | [guide](https://github.com/pragnalabs-ai/wirebay/blob/main/tools/rovo-dev/GUIDE.md)       |
| **Tabnine Agent (IDE and CLI)**                              | `tabnine`                                                          | user, project | 2026-09-25    | [guide](https://github.com/pragnalabs-ai/wirebay/blob/main/tools/tabnine/GUIDE.md)        |
| **Trae**                                                     | `trae` `trae-ide` `traecode`                                       | project       | 2026-09-25    | [guide](https://github.com/pragnalabs-ai/wirebay/blob/main/tools/trae/GUIDE.md)           |
| **Visual Studio 2022/2026 (Windows)**                        | `visual-studio` `vs` `visualstudio`                                | user, project | 2026-09-25    | [guide](https://github.com/pragnalabs-ai/wirebay/blob/main/tools/visual-studio/GUIDE.md)  |
| **Visual Studio Code (GitHub Copilot agent mode)**           | `vscode` `code` `vs-code`                                          | user, project | 2026-09-25    | [guide](https://github.com/pragnalabs-ai/wirebay/blob/main/tools/vscode/GUIDE.md)         |
| **Warp**                                                     | `warp` `warp-terminal`                                             | user, project | 2026-09-25    | [guide](https://github.com/pragnalabs-ai/wirebay/blob/main/tools/warp/GUIDE.md)           |
| **Zed**                                                      | `zed` `zed-editor`                                                 | user, project | 2026-09-25    | [guide](https://github.com/pragnalabs-ai/wirebay/blob/main/tools/zed/GUIDE.md)            |

<!-- /generated:tools -->

## How it works

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/pragnalabs-ai/wirebay/main/assets/diagrams/architecture-dark.png">
    <img alt="wirebay architecture: the CLI, services and sync pipeline that write tool configs, and the launcher that starts servers with only their declared secrets." src="https://raw.githubusercontent.com/pragnalabs-ai/wirebay/main/assets/diagrams/architecture-light.png" width="900">
  </picture>
</p>

wirebay does two separate jobs:

1. **Configure and sync** (when you run a command). `CommandParser` turns any phrasing into one
   command. The `SyncEngine` combines three inputs: the servers (built-in presets plus your own),
   the tools directory (where each tool keeps its config, and in which format), and your desired
   state (`~/.wirebay/config.json` globally, `.wirebay.json` per project). For each tool it renders
   a launcher entry, compares it with what wirebay wrote last time (`state.json`) to catch
   conflicts and hand edits, then edits the tool's file in place: backup first, atomic write, and
   only its own entries.
2. **Run** (when an AI tool starts a server). The tool runs `wirebay run github`. The launcher reads
   `secrets.env`, gives the server **only the keys it declares**, and starts the real server
   (`npx`, `uvx`, `docker`, or a remote URL through `mcp-remote`), passing MCP traffic straight
   through. Secrets never touch the tool's config file.

Read more in [concepts](https://github.com/pragnalabs-ai/wirebay/blob/main/docs/concepts.md) and
[architecture](https://github.com/pragnalabs-ai/wirebay/blob/main/docs/architecture.md).

## Security in brief

- Secrets live in `~/.wirebay/secrets.env`, which is readable only by you (`chmod 600` or a
  Windows ACL) and checked by `wirebay doctor`.
- Values are never printed in full or written to tool configs, logs, diffs or exports. The token
  for a remote server is passed through the environment, not the command line.
- Each tool file is backed up to `~/.wirebay/backups/` before every write (`wirebay restore <tool>`).
- wirebay makes no network calls of its own and collects no telemetry.

Details: [security model](https://github.com/pragnalabs-ai/wirebay/blob/main/docs/security.md).

## Documentation

[Getting started](https://github.com/pragnalabs-ai/wirebay/blob/main/docs/getting-started.md) ·
[CLI reference](https://github.com/pragnalabs-ai/wirebay/blob/main/docs/cli-reference.md) ·
[Command grammar](https://github.com/pragnalabs-ai/wirebay/blob/main/docs/command-grammar.md) ·
[Secrets](https://github.com/pragnalabs-ai/wirebay/blob/main/docs/secrets.md) ·
[Teams & project scope](https://github.com/pragnalabs-ai/wirebay/blob/main/docs/teams.md) ·
[Troubleshooting](https://github.com/pragnalabs-ai/wirebay/blob/main/docs/troubleshooting.md) ·
[FAQ](https://github.com/pragnalabs-ai/wirebay/blob/main/docs/faq.md) ·
[All docs](https://github.com/pragnalabs-ai/wirebay/blob/main/docs/README.md)

## Contributing in 5 minutes

Most contributions are just **JSON and Markdown**:

- **Add a tool** (Windsurf, Zed, …): `npm run new:tool -- <id>`, then fill in `tools/<id>/tool.json` and `GUIDE.md`.
- **Add a server preset:** `npm run new:server -- <name> --npx <package@version> --secret KEY`.
- **Report a tool that changed its config format:** open a _config changed_ issue.

See [CONTRIBUTING.md](https://github.com/pragnalabs-ai/wirebay/blob/main/CONTRIBUTING.md). Everyone is welcome.

## Uninstall

```bash
wirebay unsync all     # remove every entry wirebay added (backups are kept)
npm rm -g "@pragnalabs.ai/wirebay"
# optionally delete ~/.wirebay (this deletes your secrets file)
```

## License

[MIT](https://github.com/pragnalabs-ai/wirebay/blob/main/LICENSE)
