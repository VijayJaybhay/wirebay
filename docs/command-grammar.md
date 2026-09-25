# Command grammar

wirebay understands the ways people naturally phrase a command. Every command prints what it
understood, so there are no surprises:

```console
$ wirebay push github to codex and cursor
→ sync servers=[github] tools=[codex,cursor]
```

## Rules

1. **The first word is the verb.** Aliases are accepted (table below).
2. **Other words are classified automatically.** A server name counts as a server and a tool name
   or alias counts as a tool. Server names can never clash with tool names, so this is unambiguous.
3. **Filler words are optional:** `to`, `into`, `on`, `onto`, `for`, `in`, `from`, `and`, `with`,
   and commas.
4. **`all`** (or `--all`, `*`) means every server when it comes before a direction word, and every
   installed tool after one (`to all`, `from all`). **`everything`** means all servers × all tools.
5. **Leave things out to use defaults:**
   - no servers → every server you added
   - no tools → the tools each server is enabled for
   - `add X` with no tools → the tools detected at `wirebay init`
6. **Typos** get a suggestion: `wirebay snyc` → *Did you mean "sync"?*
7. **Options can go anywhere**, and `--to`, `--from`, `--for` and `--server` accept comma-separated lists.

## Verbs and aliases

| Verb | Also accepted |
|---|---|
| `add` | `install`, `new` |
| `sync` | `push`, `apply`, `deploy` |
| `export` | `generate` |
| `enable` | `on` |
| `disable` | `off` |
| `remove` | `rm`, `delete`, `uninstall` |
| `unsync` | `detach` |
| `list` | `ls`, `status` |
| `tools` | `clients` |
| `secrets` | `secret`, `keys` |
| `doctor` | `check` |
| `init` | `setup` |

`update` is deliberately *not* an alias, so it can't be confused with upgrading wirebay.

## Tool names

Every tool has an id and aliases (from its `tool.json`):

| Tool | Accepted names |
|---|---|
| Claude Code | `claude-code`, `claude`, `cc` |
| Claude Desktop | `claude-desktop`, `desktop`, `claude-app` |
| Codex | `codex`, `codex-cli`, `codex-desktop` |
| Cursor | `cursor` |
| VS Code | `vscode`, `code`, `vs-code` |
| Gemini CLI | `gemini`, `gemini-cli` |

## Equivalent phrasings

| Intent | Any of these |
|---|---|
| Sync everything everywhere | `sync` · `sync all` · `sync --all` · `sync everything` · `push all` |
| All servers → Codex | `sync codex` · `sync to codex` · `sync all to codex` · `sync --to codex` |
| One server → one tool | `sync github codex` · `sync github to codex` · `sync github --to codex` |
| One server → all tools | `sync github to all` · `sync github --all` |
| Many × many | `sync github netlify to codex cursor` · `sync github,netlify --to codex,cursor` |
| Add and sync | `add github to codex` · `install github on claude` · `add github --to codex` |
| Remove from one tool | `remove github from cursor` · `disable github from cursor` · `off github cursor` |
| Remove everywhere | `remove github` · `rm github from all` |
| Show status | `list` · `ls` · `status` · `ls codex` |
| Preview | add `--dry-run` or `-n` to any command that changes files |

These rows are tested in `test/unit/parse.test.ts`. If you add a phrasing, add it there.

## Special cases

- `sync github to cursor` also **enables** github for cursor. Naming both means "I want this there".
- `remove github from cursor` = `disable github from cursor`: the definition and other tools are kept.
- `remove github` removes it from wirebay and every tool. Custom definitions stay in
  `~/.wirebay/servers/` unless you pass `--purge`.
