# Code guide

wirebay is written in TypeScript with **classes, explicit types and TSDoc on everything public**.
Design patterns are used where they make the code easier to extend. A newcomer should be able to
find where to change something from the class names alone.

## Principles

1. **Model the domain with classes.** `ServerDefinition`, `Tool`, `SyncEngine`,
   `LaunchPlanner`… Plain data (JSON shapes) is described with `interface`s in
   `src/core/types.ts`.
2. **Depend on services, don't create them.** Commands and services get what they need from
   `AppContext` (the composition root) or through their constructor. That keeps everything
   testable with a sandboxed context.
3. **Data over code.** Tools, presets, flags and grammar words are data. Code interprets them.
4. **Never lose user data.** Back up before every write, write atomically, touch only managed
   entries, and stop on doubt (drift or conflict) unless `--force` is given.
5. **Never leak a secret.** Not in output, logs, errors, diffs, exports or tests.
6. **Errors tell you what to do next.** Use `throw new WirebayError("what went wrong", { hint: "how to fix it" })`.

## Design patterns in use

| Pattern                             | Where                                                                                       | Why                                                                                                                                                            |
| ----------------------------------- | ------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Composition root / DI container** | `app/AppContext.ts`                                                                         | One place creates and wires services, lazily. Tests pass a sandboxed `env`.                                                                                    |
| **Command**                         | `commands/Command.ts` + one class per verb                                                  | Each command owns its name, aliases, help and `run()`. `CommandRegistry` collects them, and the parser's verb table and the CLI reference are derived from it. |
| **Strategy**                        | `core/formats/ConfigFormat.ts` → `JsonConfigFormat`, `TomlConfigFormat`, `YamlConfigFormat` | One interface for reading and editing a config format. `ConfigFormatFactory` picks one from `tool.json → format`.                                              |
| **Template Method**                 | `core/adapters/ToolAdapter.ts` → `FileToolAdapter`, `ClaudeCodeAdapter`                     | The read/render/commit steps are shared; subclasses override only what differs (Claude Code commits through its CLI).                                          |
| **Factory**                         | `core/adapters/AdapterFactory.ts`, `ConfigFormatFactory`                                    | Chooses and caches the right implementation for a tool.                                                                                                        |
| **Registry**                        | `ServerRegistry`, `ToolRegistry`, `CommandRegistry`                                         | Load, validate and cache the known servers, tools and commands.                                                                                                |
| **Interface for extension**         | `core/secrets/SecretsBackend.ts`                                                            | A new secrets backend (keychain, 1Password) implements one interface.                                                                                          |

## Where things live

```
src/
  cli.ts                     entry point: new WirebayApp().run(argv)
  app/          WirebayApp (registers commands, error handling), AppContext (services)
  cli/          CommandParser, Grammar (flags and words), Suggester, Terminal
  commands/     Command base class, CommandRegistry, one *Command class per verb, support/
  core/
    adapters/   ToolAdapter (template method), FileToolAdapter, ClaudeCodeAdapter, AdapterFactory
    directory/  ToolDirectory (examples, verify, index)
    doctor/     Doctor
    formats/    ConfigFormat strategies + factory
    io/         SafeFileWriter, BackupManager
    launch/     LaunchPlanner, ProcessCommand, ServerLauncher, LaunchLogger
    mcp/        McpHandshakeClient
    platform/   WirebayPaths, ExecutableResolver, FilePermissions
    schema/     SchemaValidator
    secrets/    SecretsBackend (interface), SecretMasker, EnvFileSecretsStore
    servers/    ServerDefinition, ServerRegistry
    store/      ConfigStore, StateStore, EntryHasher
    sync/       EntryRenderer, Reconciler, SyncEngine
    template/   TemplateExpander
    tools/      Tool, ToolRegistry
    errors.ts   WirebayError, UsageError, ConfigParseError, ExitCode
    types.ts    JSON shapes (ServerDef, ToolManifest, WirebayConfig, …)
```

One class per file, and the file is named after the class. A small group of closely related
classes may share a file (e.g. `EnableCommands.ts`).

## TypeScript rules

- Node 24 runs `.ts` directly by stripping types, so only **erasable** syntax is allowed:
  - no `enum` (use `as const` objects, like `ExitCode`)
  - no `namespace`
  - no constructor _parameter properties_: declare fields and assign them in the constructor
  - `abstract`, `readonly`, `private`, `protected` and `override` are fine

  `tsconfig.json` enforces this with `erasableSyntaxOnly`.

- Import local files with the `.ts` extension; the build rewrites them to `.js`.
- Use `import type` for type-only imports (`verbatimModuleSyntax`).
- `strict` is on. Prefer precise types over `any`; `unknown` plus narrowing when needed.

## Documentation (TSDoc)

- Every file starts with a `/** … @module */` comment saying what it is for.
- Every exported class, interface, method and non-obvious field has a TSDoc comment.
- Use `@param`, `@returns`, `@throws` and `@example` where they help.
- Link across modules with `{@link core/errors!WirebayError}` (module path `!` name).
- Build the API docs locally with `npm run docs:api`. They are written to `docs-api/`, which is
  git-ignored; TypeDoc must run with zero warnings.

## Adding a command

1. Create `src/commands/<Name>Command.ts` with a class extending `Command`:
   ```ts
   export class HelloCommand extends Command {
     readonly name = "hello";
     override readonly aliases = ["hi"];
     readonly help = { usage: "wirebay hello", summary: "Say hello.", examples: ["wirebay hello"] };
     async run(input: ParsedCommand, ctx: AppContext): Promise<number> {
       ctx.terminal.out("hello");
       return ExitCode.Ok;
     }
   }
   ```
   Set `targeted = true` if its words are servers or tools, and `acceptsFreeWords = true` if it
   takes other words.
2. Register it in `WirebayApp.createRegistry()`.
3. Add flags to `FLAGS` in `src/cli/Grammar.ts` if needed.
4. Tests: parser rows in `test/unit/parse.test.ts`, behaviour in `test/e2e/cli.test.ts`.
5. `npm run gen:docs` regenerates `docs/cli-reference.md` from the class metadata.

## Output rules

- Human output goes through `ctx.terminal.out()`. The canonical-command echo and warnings go
  through `ctx.terminal.note()` (stderr), and `--json` through `ctx.terminal.json()`.
- **`wirebay run` never writes to stdout** (it carries the MCP protocol).

## Lint and format policy

- ESLint uses `typescript-eslint` **strict** and **stylistic** type-checked presets, plus explicit
  return types, `import type`, `eqeqeq` and no `console` in library code. Prettier owns formatting
  (140 columns, double quotes, trailing commas).
- **Zero errors and zero warnings**, enforced with `--max-warnings 0` locally, in git hooks and in CI.
- **No suppressions.** `noInlineConfig` turns off inline lint directives, `ban-ts-comment` rejects
  TypeScript suppression comments, and `no-warning-comments` reports formatter and coverage escape
  comments. Ignore lists hold only generated or build output.
- Typical fixes: use `defined(value, what)` (from `core/util/values.ts`) instead of a non-null
  assertion; narrow `unknown` values with a type or guard; convert numbers with `String()` in
  template literals; use `Map`/filtering instead of `delete obj[key]`; treat empty env values with
  `nonEmpty()` and `??`.

## Style

Prettier decides layout; `npm run format` applies it. `npm run lint` checks types, lint and
formatting together.
