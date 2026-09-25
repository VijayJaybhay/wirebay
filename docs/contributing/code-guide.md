# Code guide

## Principles

1. **Readable over clever.** Plain functions, small files, obvious names. A newcomer should
   understand any file in a few minutes.
2. **Data over code.** Tools, presets, verbs and aliases are data. Code interprets them.
3. **Never lose user data.** Back up before every write, write atomically, touch only managed
   entries, and stop on doubt (drift or conflict) unless `--force` is given.
4. **Never leak a secret.** Not in output, logs, errors, diffs, exports or tests.
5. **Errors tell you what to do next.** `throw new WirebayError("what went wrong", { hint: "how to fix it" })`.

## TypeScript without a build

- Node 24 runs `.ts` files directly by stripping types. Only **erasable** syntax is allowed:
  no `enum`, `namespace`, parameter properties or `import =`. `tsconfig.json` enforces this with
  `erasableSyntaxOnly`.
- Import local files with the `.ts` extension; the build rewrites them to `.js`.
- Use `import type` for type-only imports (`verbatimModuleSyntax`).

## File conventions

- Each file starts with a comment of one to three lines saying what it is for.
- Exported functions have a JSDoc comment.
- `src/commands/*` stay thin: parse flags, call `core/`, print. Logic lives in `core/`.
- Output: human output goes to stdout. The canonical-command echo and warnings go to stderr.
  `--json` output goes to stdout only.
- **`wirebay run` never writes to stdout** (MCP protocol).

## Adding a command

1. Add the verb and aliases to `VERBS` in `src/cli/grammar.ts`, and to `TARGETED_VERBS` if it takes
   servers/tools.
2. Add flags to `FLAGS` if needed.
3. Create `src/commands/<name>.ts` exporting `async function <name>(cmd: ParsedCommand): Promise<number>`.
4. Dispatch it in `src/cli.ts`.
5. Add help text to `COMMAND_HELP` in `src/commands/help.ts`.
6. Tests: parser rows in `test/unit/parse.test.ts`, behaviour in `test/e2e/cli.test.ts`.
7. `npm run gen:docs` regenerates `docs/cli-reference.md`.

## Style

Two-space indent, double quotes, semicolons, trailing commas, lines up to about 140 characters.
`npm run lint` type-checks everything.
