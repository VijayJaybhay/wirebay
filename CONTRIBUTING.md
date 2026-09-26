# Contributing to wirebay

Thanks for helping! wirebay is built so that **most contributions need no TypeScript at all**.
Adding a tool or a server is JSON plus Markdown, and the tests for it are generated for you.

## Setup (3 commands)

```bash
git clone https://github.com/pragnalabs-ai/wirebay.git && cd wirebay
npm install
npm test
```

You need Node.js 24 or newer. There is no build step: `node src/cli.ts <command>` runs the CLI from
source. To try things safely, point wirebay at a throwaway home:

```bash
# macOS / Linux
export WIREBAY_USER_HOME=/tmp/wb WIREBAY_HOME=/tmp/wb/.wirebay
# Windows PowerShell
$env:WIREBAY_USER_HOME="$env:TEMP\wb"; $env:WIREBAY_HOME="$env:TEMP\wb\.wirebay"

node src/cli.ts init
node src/cli.ts add github to cursor --dry-run
```

## Three ways to contribute

| You want to…                                                             | You touch                                                                        | Code?                    | Guide                                             |
| ------------------------------------------------------------------------ | -------------------------------------------------------------------------------- | ------------------------ | ------------------------------------------------- |
| Support a new AI tool (Windsurf, Zed, …) or fix one whose config changed | `tools/<id>/tool.json`, `GUIDE.md`                                               | No                       | [Add a tool](docs/contributing/add-a-tool.md)     |
| Add a built-in MCP server or update one                                  | `presets/<name>.json`, `docs/servers/<name>.md`, `templates/secrets.env.example` | No                       | [Add a server](docs/contributing/add-a-server.md) |
| Improve the CLI itself                                                   | `src/`, `test/`                                                                  | Yes (TypeScript classes) | [Code guide](docs/contributing/code-guide.md)     |

Keeping the tools directory fresh matters as much as new features: see
[Maintaining the directory](docs/contributing/maintaining-directory.md). Entries that haven't been
re-verified for 90 days show up in a monthly issue and make good first issues.

## Before you open a pull request

```bash
npm run check       # everything below in one go (also runs on git push)
npm run lint        # type check, ESLint and Prettier: zero errors and zero warnings
npm test            # unit, snapshot and end-to-end tests
npm run validate    # schemas, naming rules, generated files up to date
npm run gen:docs    # if you changed presets/, tools/, the grammar or command help
npm run docs:api    # if you changed src/: TSDoc must build without warnings
npx changeset       # describe user-visible changes (pick patch/minor/major)
```

Then fill in the PR checklist. Small, focused PRs get merged fastest.

## Code quality policy: zero findings, no suppressions

- `npm run lint` runs the type check, ESLint (strict, type-aware) and a Prettier check. It must
  report **zero errors and zero warnings**.
- **Fix the code; never silence the tool.** Inline lint directives are switched off, TypeScript
  suppression comments are rejected, formatter escape comments are reported, and ignore lists only
  cover generated or build output. If you think a rule is wrong for this project, open an issue to
  discuss changing it for everyone.
- `npm run lint:docs` (TypeDoc) must also produce zero warnings.
- **Git hooks** (installed automatically by `npm install`):
  - pre-commit: Prettier and ESLint on staged files
  - pre-push: `npm run check` (lint, tests, validate, API docs)
- `npm run format` formats everything; `npm run check` runs every gate that CI runs.

## Ground rules

- **Never commit real tokens**, not even expired ones. Use key names like `MY_TOKEN` and fake
  values like `test_value`. CI runs a secret scanner.
- **Be kind.** We follow the [Code of Conduct](CODE_OF_CONDUCT.md).
- **Security issues** go through [private reporting](SECURITY.md), not public issues.

## Commit messages

We use [Conventional Commits](https://www.conventionalcommits.org/): `feat:`, `fix:`, `docs:`,
`tools:` (tools directory), `presets:`, `test:`, `chore:`. Example: `tools: add windsurf`.

## Dependencies

wirebay keeps its dependencies few and boring. Current runtime dependencies and why:

| Package          | Why                                                                                                                                                 |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `jsonc-parser`   | Parse JSON with comments (VS Code, Gemini, Cursor configs)                                                                                          |
| `smol-toml`      | Parse and write TOML (Codex `config.toml`)                                                                                                          |
| `yaml`           | Comment-preserving YAML edits, for tools that use YAML                                                                                              |
| `ajv`            | Validate presets, tool manifests and config against the JSON Schemas                                                                                |
| `@clack/prompts` | Friendly prompts and hidden input for secrets                                                                                                       |
| `diff`           | Show `--dry-run` diffs                                                                                                                              |
| `mcp-remote`     | Stdio↔HTTP bridge for remote servers, pinned and started with Node directly (starting it through `npx` was slow enough for Claude Code to time out) |

Development-only: `typescript`, `@types/node`, `@changesets/cli`, `typedoc` (API docs), `eslint` +
`typescript-eslint` + `@eslint/js` + `eslint-config-prettier` + `globals` (linting), `prettier`
(formatting), `simple-git-hooks` + `lint-staged` (git hooks).

Please open an issue before adding a new one.

## Releases

Maintainers merge the "Version Packages" PR opened by Changesets, and CI publishes to npm with
provenance. See [Releasing](docs/contributing/releasing.md).
