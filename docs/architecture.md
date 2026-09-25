# Architecture

## Data flow

```
                     WirebayApp ── CommandParser ── CommandRegistry ── *Command.run(input, ctx)
                                                                              │
                                                                         AppContext (services)
                                                                              │
 presets/*.json ─┐                                                            ▼
 ~/.wirebay/     ├─▶ ServerRegistry ─┐                               SyncEngine.run()
   servers/*.json┘                   │   ConfigStore (config.json) ─────▶ │
 tools/*/tool.json ─▶ ToolRegistry ──┤                                    ▼
 ~/.wirebay/tools/ ┘                 │                         EntryRenderer.render(server, tool)
                                     │                                    │
                                     │   StateStore (state.json) ────▶ Reconciler.plan / apply
                                     │                                    │
                                     │           AdapterFactory ──▶ ToolAdapter (read · render · commit)
                                     │                                    │
                                     │           ConfigFormatFactory ──▶ Json/Toml/YamlConfigFormat
                                     │                                    │
                                     │                 BackupManager + SafeFileWriter (atomic)
                                     │
 tool starts server ─▶ wirebay run X ─▶ LaunchPlanner.plan ◀── EnvFileSecretsStore (secrets.env)
                                        (declared keys only)  ─▶ ServerLauncher (spawn, stdio passthrough)
```

## Layers

| Layer | Folder | Responsibility |
|---|---|---|
| Application | `src/app/` | `WirebayApp` registers commands, parses, runs, reports errors. `AppContext` creates and wires services. |
| CLI | `src/cli/` | Parsing (`CommandParser`), grammar data (`Grammar`), suggestions (`Suggester`), output (`Terminal`). |
| Commands | `src/commands/` | One class per verb (Command pattern); `support/` has `TargetSelector` and `SyncReporter`. |
| Core | `src/core/` | Domain and services: servers, tools, secrets, formats, adapters, sync, launch, doctor. Knows nothing about the CLI. |

## Key classes

| Class | Responsibility |
|---|---|
| `AppContext` | Lazily creates and shares services; the one place dependencies are wired |
| `WirebayPaths` | Home folders, package paths, per-OS path expansion |
| `ExecutableResolver` | Finds `npx`/`uvx`/`docker` (remembered paths, PATH, well-known folders) |
| `ServerDefinition` / `ServerRegistry` | A server's rules (declared/required keys, auth, variants) / loading presets + user overrides |
| `Tool` / `ToolRegistry` | A tool's config paths and install detection / loading the tools directory |
| `EnvFileSecretsStore` | The `secrets.env` backend (implements `SecretsBackend`) |
| `ConfigFormat` + implementations | Read and edit JSON/JSONC, TOML (managed block), YAML without disturbing other content |
| `ToolAdapter` + `AdapterFactory` | Read, render and commit one tool file; Claude Code's user scope commits through its CLI |
| `EntryRenderer` | The launcher entry for (server, tool): absolute / portable / npx modes |
| `Reconciler` | Plans per-file changes: conflicts, drift, pruning; applies and records hashes |
| `SyncEngine` | Orchestrates a sync across tools |
| `LaunchPlanner` / `ServerLauncher` | Builds the child env and command (secrets filtering, mcp-remote bridge) / spawns it |
| `McpHandshakeClient` / `Doctor` | A minimal MCP client / all health checks |

The API reference with every class and method is generated from TSDoc: `npm run docs:api`.

## Where do I change X?

| I want to… | Change |
|---|---|
| Support a new tool | `tools/<id>/tool.json` (+ `GUIDE.md`). Code only if the file-based adapter can't express it: subclass `ToolAdapter` and register it in `AdapterFactory` |
| Add a built-in server | `presets/<name>.json` |
| Add a command | a new `Command` subclass, registered in `WirebayApp.createRegistry()` |
| Add an option | `FLAGS` in `src/cli/Grammar.ts` |
| Change what entries look like | `EntryRenderer` (then `npm run gen:docs`) |
| Support a new config format | a new `ConfigFormat` implementation + `ConfigFormatFactory` + `schemas/tool.schema.json` |
| Add a secrets backend | implement `SecretsBackend`, return it from `AppContext.secrets` |
| Change sync rules | `Reconciler` + `test/unit/reconcile.test.ts` |

## Design decisions

- **Launcher instead of writing secrets:** see [concepts](concepts.md#why-a-launcher-instead-of-writing-tokens-into-configs).
- **Data-driven tools:** most tools differ only in path, format and key names, so a JSON manifest
  plus the file-based adapter covers them, and contributors don't need TypeScript.
- **Managed block for TOML:** no TOML library keeps comments on rewrite, so wirebay owns a marked
  region and leaves the rest of the file byte for byte.
- **Precise JSON edits:** jsonc-parser's insert and remove reformat neighbouring entries, so
  `JsonConfigFormat` inserts and removes by offset, and uses jsonc-parser only to replace values.
- **State hashes:** `state.json` stores actual and desired hashes per managed entry. That tells
  wirebay's writes apart from hand edits, and handles tools whose CLI normalises entries.
- **No build in development:** Node 24 strips TypeScript types, so `node src/cli.ts` runs directly.
  Publishing compiles to `dist/`, because Node doesn't strip types inside `node_modules`.
