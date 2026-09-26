# Global vs project servers (and teams)

Every tool can get MCP servers in two places:

| Scope             | Flag                          | wirebay keeps the list in | Tool files it writes                                        |
| ----------------- | ----------------------------- | ------------------------- | ----------------------------------------------------------- |
| **global** (user) | `--global` (the default)      | `~/.wirebay/config.json`  | your personal config, e.g. `~/.cursor/mcp.json`             |
| **project**       | `--project` or `--dir <path>` | `<project>/.wirebay.json` | files inside the project, e.g. `<project>/.cursor/mcp.json` |

Use **global** for servers you want in every repo (GitHub, docs search). Use **project** for servers
that only make sense in one codebase (its database, its Firebase project), or when you don't want
a server loaded everywhere.

## Add servers to a project

```bash
cd ~/code/my-app
wirebay add supabase to cursor claude --project      # this project only
wirebay add github to all                            # global, as usual

# Or name the project folder from anywhere:
wirebay add supabase to vscode --dir ~/code/my-app
wirebay init --dir ~/code/my-app                     # just create an empty .wirebay.json
```

**Which folder is "the project"?** In order: the folder given with `--dir`, the nearest folder
(from where you are, going up) that has a `.wirebay.json`, the nearest git repository root, or the
current folder. So you can run wirebay from any subfolder.

The project's servers are saved in `<project>/.wirebay.json`:

```json
{
  "$schema": "https://raw.githubusercontent.com/pragnalabs-ai/wirebay/main/schemas/project.schema.json",
  "version": 1,
  "servers": {
    "supabase": { "tools": ["cursor", "claude-code"] }
  }
}
```

and **portable** entries go into the project's tool files:

| Tool        | File                    |
| ----------- | ----------------------- |
| Claude Code | `.mcp.json`             |
| Cursor      | `.cursor/mcp.json`      |
| VS Code     | `.vscode/mcp.json`      |
| Gemini CLI  | `.gemini/settings.json` |

```json
{
  "mcpServers": {
    "supabase": { "type": "stdio", "command": "wirebay", "args": ["run", "supabase"] }
  }
}
```

Not every tool has a project-level MCP file (Codex and Claude Desktop don't, for example). Those
are skipped with a note: use `--global` for them. The **Scopes** column of the
[tools directory](../tools/INDEX.md) shows what each tool supports.

## Everyday commands

Inside a project that has a `.wirebay.json`, commands that sync or report act on **both** scopes;
commands that change things act on the global list unless you pass `--project`:

```bash
wirebay list                          # two tables: global, then this project
wirebay sync                          # sync global servers and this project's servers
wirebay sync --project                # only this project
wirebay enable github for vscode --project
wirebay remove supabase --project
wirebay unsync --project              # take this project's entries back out of its tool files
```

Prefer project scope by default? Set `"defaultScope": "project"` in `~/.wirebay/config.json`, then
use `--global` for the exceptions.

## Sharing with your team

`.wirebay.json` and the project tool files contain no paths from your machine and no tokens.
Commit them. Each teammate runs:

```bash
npm install -g @pragnalabs.ai/wirebay
wirebay init
wirebay secrets set SUPABASE_ACCESS_TOKEN   # their own token
wirebay sync --project                      # optional: re-create the tool files from .wirebay.json
```

Each person's `wirebay run supabase` uses **their own** `~/.wirebay/secrets.env`. If a teammate uses
a server that isn't a built-in preset, they need the same definition: share the
`~/.wirebay/servers/<name>.json` file (it holds no secrets), or better, contribute it as a preset.

## Windows teammates

Most tools can't start the `wirebay.cmd` shim directly on Windows, so portable entries written
_on Windows_ use `cmd /c wirebay run …`, which doesn't work on macOS or Linux. If your team is mixed:

- commit only `.wirebay.json` and let each person run `wirebay sync --project` (add the tool files
  to `.gitignore`), or
- generate project files on macOS/Linux (plain `wirebay run …` works on Windows in VS Code, which
  can start `.cmd` shims).

## Tips

- Add `wirebay sync --project` to your project README's setup steps.
- `wirebay sync --project --dry-run` shows exactly what will change in the repo.
- Global and project servers can be used together; each tool merges them in its own way (see each
  tool's guide in the [tools directory](../tools/INDEX.md)). Avoid giving a project server the same
  name as a global one.
