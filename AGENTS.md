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
| `src/app/` | `WirebayApp` (registers commands, runs them, reports errors) and `AppContext` (creates and wires every service) |
| `src/cli/` | `CommandParser` (any phrasing → canonical command), `Grammar` (flags and words), `Suggester`, `Terminal` |
| `src/commands/` | `Command` base class, `CommandRegistry`, one `*Command` class per verb |
| `src/core/` | Domain and services, one class per file: registries, secrets, config formats, adapters, sync, launch, doctor |
| `src/core/launch/LaunchPlanner.ts` | Security core: which secrets a server receives |
| `src/core/sync/Reconciler.ts` | Sync rules: conflicts, drift, pruning |
| `presets/` | Built-in server definitions (JSON, schema `schemas/server.schema.json`) |
| `tools/<id>/` | Tools directory: `tool.json`, `GUIDE.md`, `examples/` (generated) |
| `docs/` | User and contributor documentation; `docs/servers/catalog.md` is generated |
| `scripts/` | `DocsGenerator` (gen-docs), `RepoValidator` (validate), scaffolders |
| `test/` | `node:test` suites: `unit/`, `snapshot/`, `e2e/`, `fixtures/`; `helpers.ts` has `Sandbox` |

See [docs/architecture.md](docs/architecture.md) for the data flow and key classes.

## Commands

```bash
npm install
npm test                  # all tests (node --test)
npm run lint              # type check
npm run validate          # schemas, naming rules, generated files up to date
npm run gen:docs          # regenerate examples, tools/INDEX.md, README tables, CLI reference
node src/cli.ts <args>    # run the CLI from source (no build step)
npm run build             # compile to dist/ (only needed for publishing)
npm run docs:api          # API reference from TSDoc (docs-api/, must have zero warnings)
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
4. **Tool files are only written through `ToolAdapter.commit`** (`BackupManager` + `SafeFileWriter`): backup first, atomic write, mtime check.
5. **Only touch entries wirebay manages** (recorded in `state.json`). Foreign entries are conflicts;
   hand-edited managed entries are drift. Both need `--force`.
6. After changing `presets/`, `tools/`, `src/cli/Grammar.ts` or a command's `help`, run
   `npm run gen:docs` and commit the regenerated files.

## Code conventions

Full guide: [docs/contributing/code-guide.md](docs/contributing/code-guide.md).

- **Object-oriented TypeScript:** model concepts as classes with explicit types. Depend on services
  from `AppContext` or constructor arguments, never on globals like `process.env` deep in the code.
- **Patterns in use:** Command (`commands/`), Strategy (`core/formats/`), Template Method + Factory
  (`core/adapters/`), Registry (servers, tools, commands), composition root (`AppContext`). Follow them
  when extending.
- **TSDoc on everything exported:** a `@module` comment per file, plus `@param`, `@returns`,
  `@throws` and `@example` where useful. `npm run docs:api` must stay warning-free.
- **Erasable TypeScript only** (Node runs `.ts` directly): no `enum` (use `as const`), no
  `namespace`, no constructor parameter properties. Import with `.ts` extensions, and use
  `import type` for types.
- One class per file, named after the class.
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
