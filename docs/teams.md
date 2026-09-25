# Teams and project scope

Share MCP servers with your team by committing project-scope config files, with no secrets in them.

## How it works

```bash
cd my-repo
wirebay add github to claude cursor vscode --scope project
```

This writes **portable** entries into the repo:

| Tool | File |
|---|---|
| Claude Code | `.mcp.json` |
| Cursor | `.cursor/mcp.json` |
| VS Code | `.vscode/mcp.json` |
| Gemini CLI | `.gemini/settings.json` |

```json
{
  "mcpServers": {
    "github": { "type": "stdio", "command": "wirebay", "args": ["run", "github"] }
  }
}
```

The files contain no paths from your machine and no tokens. Commit them.

## What each teammate does

```bash
npm install -g wirebay
wirebay init
wirebay secrets set GITHUB_PERSONAL_ACCESS_TOKEN   # their own token
```

Each person's `wirebay run github` uses **their own** `~/.wirebay/secrets.env`. If a teammate uses
a server that isn't a built-in preset, they need the same definition: share the
`~/.wirebay/servers/<name>.json` file (it holds no secrets), or better, contribute it as a preset.

## Windows teammates

Most tools can't start the `wirebay.cmd` shim directly on Windows, so portable entries written
*on Windows* use `cmd /c wirebay run …`, which doesn't work on macOS or Linux. If your team is mixed:

- generate project files on macOS/Linux (plain `wirebay run …` works on Windows in VS Code, which
  can start `.cmd` shims), or
- keep project files per OS, or use user scope for Windows teammates.

## Tips

- Add `wirebay` to your project README's setup steps.
- `wirebay sync --scope project --dry-run` shows exactly what will change in the repo.
- Project and user scope can both be used; the tool merges them in its own way (see each tool's
  guide in the [tools directory](../tools/INDEX.md)).
