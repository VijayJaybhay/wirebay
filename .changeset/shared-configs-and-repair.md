---
"@pragnalabs.ai/wirebay": minor
---

Tools that read other tools' MCP configs, and safer writes:

- **Fix:** wirebay no longer writes Visual Studio's global `%USERPROFILE%\.mcp.json` for `all` or the default tools. Claude Code also reads `.mcp.json` from parent folders and reported `Missing "mcpServers" — found "servers" instead`. That file is now opt-in (written only when you name `visual-studio`), and `wirebay doctor --fix` removes wirebay's entries from an existing one.
- **Know who reads what:** manifests now record which tools also read other tools' files (`alsoReads`, with official sources): Devin imports Claude Code's and Cursor's configs, VS Code reads a workspace `.mcp.json` and Copilot CLI's file, and so on. wirebay still writes every tool's own file and tells you when a server may appear twice: after `sync`, in `wirebay list`, and in the new `wirebay tools <tool>`.
- **`wirebay doctor --fix`** (with `--yes` / `--dry-run`) repairs files that break another tool and brings out-of-date entries in line.
- **Cleaner files:** wirebay deletes a config file it created once the last server is removed from it (with a backup), and checks every write by reading it back, restoring the previous file if anything is off.
- **Home folder:** it is never used as a project (project files there are your global files).
- **Faster remote servers:** remote servers start the bundled `mcp-remote` directly instead of through `npx`, so tools with short start-up limits (Claude Code "Request timed out") connect reliably.
- **Manifest fixes from current docs:**
  - Cursor entries include `"type": "stdio"`.
  - Codex gets a project scope (`.codex/config.toml`).
  - Amp uses the right Windows path.
  - Continue gets a global folder.
  - Tabnine and Amp are marked as expanding `${VAR}`.
  - Visual Studio is no longer detected just because `~/.mcp.json` exists.
