# AGENTS.md

Instructions for AI coding agents (Claude Code, Codex, Cursor, Gemini, Copilot, …) working in
this repository. Humans: see [CONTRIBUTING.md](CONTRIBUTING.md). The content is the same.

## What this project is

`wirebay` is a Node.js CLI, published to npm. It keeps one list of MCP servers and one private
secrets file (`~/.wirebay/secrets.env`), and syncs launcher entries (`wirebay run <server>`) into
each AI tool's MCP config. It never writes secrets into tool configs.

## Repo map

| Path | What lives there |
|---|---|
| `src/cli.ts` | Entry point: parse → dispatch → exit code |
| `src/cli/grammar.ts` | Verbs, aliases, filler words, flags (data) |
| `src/cli/parse.ts` | Turns any phrasing into `{verb, servers, tools, rest, flags}` |
| `src/commands/` | One file per command |
| `src/core/launcher.ts` | `wirebay run`: builds the child env from declared secrets and spawns the server |
| `src/core/reconcile.ts` | Plans and applies changes to one tool file (conflicts, drift, pruning) |
| `src/core/sync.ts` | Config → rendered entries → plans → apply |
| `src/core/render.ts` | What a tool entry looks like (absolute / portable / npx modes) |
| `src/adapters/` | Generic adapter driven by `tool.json`; `overrides/` only for special tools |
| `src/merge/` | Comment-preserving JSON/JSONC, TOML (managed block) and YAML edits |
| `presets/` | Built-in server definitions (JSON, schema `schemas/server.schema.json`) |
| `tools/<id>/` | Tools directory: `tool.json`, `GUIDE.md`, `examples/` (generated) |
| `templates/` | `secrets.env.example` and doc templates |
| `docs/` | User and contributor documentation |
| `scripts/` | `gen-docs`, `validate`, `new-tool`, `new-server` |
| `test/` | `node:test` suites: `unit/`, `snapshot/`, `e2e/`, `fixtures/` |

## Commands

```bash
npm install
npm test                  # all tests (node --test)
npm run lint              # type check
npm run validate          # schemas, naming rules, generated files up to date
npm run gen:docs          # regenerate examples, tools/INDEX.md, README tables, CLI reference
node src/cli.ts <args>    # run the CLI from source (no build step)
npm run build             # compile to dist/ (only needed for publishing)
```

When you try the CLI by hand, use a throwaway home so you never touch real configs:
`WIREBAY_USER_HOME=/tmp/wb WIREBAY_HOME=/tmp/wb/.wirebay node src/cli.ts …`

## Hard rules

1. **Never put secret values** in presets, docs, examples, tests, logs, error messages or generated
   output. Use key *names* only. Tests use obviously fake values.
2. **Never read or print the user's real `~/.wirebay/secrets.env`** or real tool configs. Tests and
   manual runs use `WIREBAY_HOME` and `WIREBAY_USER_HOME` pointing to a temp folder.
3. **The launcher (`wirebay run`) must never write to stdout.** stdout carries the MCP protocol.
   Diagnostics go to stderr and `~/.wirebay/logs/`.
4. **Tool files are only written through `src/core/io.ts`**: backup first, atomic write, mtime check.
5. **Only touch entries wirebay manages** (recorded in `state.json`). Foreign entries are conflicts;
   hand-edited managed entries are drift. Both need `--force`.
6. After changing `presets/`, `tools/`, `src/cli/grammar.ts` or `src/commands/help.ts`, run
   `npm run gen:docs` and commit the regenerated files.

## Code conventions

- TypeScript with **erasable syntax only** (no `enum`, `namespace` or parameter properties), so
  Node runs `.ts` files directly. Import with `.ts` extensions.
- Small single-purpose files, each starting with a short comment that explains what it does.
- Plain functions over classes; no clever metaprogramming.
- JSDoc on exported functions.
- Every user-facing error says how to fix it: `throw new WirebayError(msg, { hint })`.
- Minimal dependencies. Ask before adding one, and justify it in CONTRIBUTING.md.

## Workflows

Each workflow is written in one place. Follow the guide exactly:

- **Add an MCP server preset:** [docs/contributing/add-a-server.md](docs/contributing/add-a-server.md)
- **Add a new AI tool / coding tool:** [docs/contributing/add-a-tool.md](docs/contributing/add-a-tool.md)
- **Re-verify tools and presets (maintenance):** [docs/contributing/maintaining-directory.md](docs/contributing/maintaining-directory.md)
- **Change core code:** [docs/contributing/code-guide.md](docs/contributing/code-guide.md) and [docs/contributing/testing.md](docs/contributing/testing.md)
- **Release:** [docs/contributing/releasing.md](docs/contributing/releasing.md)

## Definition of done

`npm run lint && npm test && npm run validate` pass, docs are updated, and a changeset is added
(`npx changeset`) for user-visible changes.
