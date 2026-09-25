# Architecture

## Data flow

```
                       ┌──────────────── desired state ────────────────┐
 presets/*.json ──┐    │ ~/.wirebay/config.json   (server → tools)     │
 ~/.wirebay/      ├──▶ core/servers.ts ─┐                               │
   servers/*.json ┘                     │                               │
 tools/*/tool.json ─▶ core/tools.ts ────┼─▶ core/sync.ts ─▶ core/render.ts (entry per tool)
 ~/.wirebay/tools/  ┘                   │        │
                                        │        ▼
                                        │   core/reconcile.ts  ◀── ~/.wirebay/state.json (applied)
                                        │        │ plan: set / remove / unchanged / issues
                                        │        ▼
                                        │   adapters/ (generic | overrides) ─▶ merge/json|toml|yaml
                                        │        │
                                        │        ▼
                                        │   core/io.ts: backup ▸ atomic write ▸ mtime check
                                        │
 tool starts server ─▶ wirebay run X ─▶ core/launcher.ts ◀── core/secrets.ts (~/.wirebay/secrets.env)
                                        (declared keys only) ─▶ spawn npx / uvx / docker / mcp-remote
```

## Module map

| Module | Responsibility |
|---|---|
| `src/cli.ts` | Entry: fast path for `run`, then parse → dispatch → exit code, error formatting |
| `src/cli/grammar.ts` | Verbs, aliases, filler words, flags: **data only** |
| `src/cli/parse.ts` | Classify words into servers/tools; did-you-mean; canonical echo |
| `src/cli/ui.ts` | Colours (NO_COLOR), tables, prompts, stdin |
| `src/commands/*` | One command per file; thin layers over `core/` |
| `src/core/paths.ts` | Home folders, per-OS path expansion, executable lookup |
| `src/core/secrets.ts` | `SecretsBackend` interface + dotenv implementation, masking, permissions |
| `src/core/servers.ts` | Load/merge presets and user servers, name rules, declared/required keys |
| `src/core/tools.ts` | Load tool manifests, aliases, install detection, config paths |
| `src/core/template.ts` | `${VAR}` expansion and optional arg groups |
| `src/core/launcher.ts` | Build the launch plan (env filtering, remote bridging, Windows shims) and run it |
| `src/core/render.ts` | Turn (server, tool, mode) into the entry written to the tool |
| `src/core/reconcile.ts` | Plan and apply per-file changes with conflict and drift detection |
| `src/core/sync.ts` | Orchestrate: config → targets → plans → apply → state |
| `src/core/io.ts` | Atomic writes, backups, restore listing |
| `src/core/store.ts` | `config.json` / `state.json`, stable hashing |
| `src/core/directory.ts` | Example rendering, tool verification, INDEX generation |
| `src/adapters/generic.ts` | Read/render/commit any tool from its manifest |
| `src/adapters/overrides/*` | Tools needing special handling (Claude Code user scope uses its CLI) |
| `src/merge/*` | Format-specific, comment-preserving edits |
| `src/mcp/handshake.ts` | Minimal MCP client for `doctor` |

## Where do I change X?

| I want to… | Change |
|---|---|
| Support a new tool | `tools/<id>/tool.json` (+ `GUIDE.md`). Code only if the generic adapter can't express it: `src/adapters/overrides/` |
| Add a built-in server | `presets/<name>.json` (+ guide, secrets template) |
| Add a verb or alias | `src/cli/grammar.ts`, `src/commands/help.ts`, a test row in `test/unit/parse.test.ts` |
| Change what entries look like | `src/core/render.ts` (and run `npm run gen:docs`) |
| Support a new config format | `src/merge/<format>.ts` + `src/adapters/generic.ts` + `schemas/tool.schema.json` |
| Add a secrets backend | Implement `SecretsBackend` in `src/core/secrets.ts` |
| Change sync rules | `src/core/reconcile.ts` + `test/unit/reconcile.test.ts` |

## Design decisions

- **Launcher instead of writing secrets:** see [concepts](concepts.md#why-a-launcher-instead-of-writing-tokens-into-configs).
- **Data-driven tools:** most tools differ only in path, format and key names, so a JSON manifest
  plus one generic adapter covers them, and contributors don't need TypeScript.
- **Managed block for TOML:** no TOML library keeps comments on rewrite, so wirebay owns a marked
  region and leaves the rest of the file byte for byte.
- **Precise JSON edits:** jsonc-parser's insert/remove reformat neighbouring entries, so
  `merge/json.ts` inserts and removes by offset, and uses jsonc-parser only to replace values.
- **State hashes:** `state.json` stores a hash per managed entry (actual and desired). That tells
  wirebay apart from hand edits and handles tools whose CLI normalises entries.
- **No build in development:** Node 24 strips TypeScript types, so `node src/cli.ts` runs directly.
  Publishing compiles to `dist/`, because Node doesn't strip types inside `node_modules`.
