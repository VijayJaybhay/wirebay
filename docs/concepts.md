# Concepts

## The problem

Every AI coding tool has its own MCP config file, format and key names. Keeping the same servers
in six tools means six copies, and usually six copies of each token in plain text.

## The idea

1. **Define servers once**, in `~/.wirebay/config.json` plus built-in presets or your own
   definitions.
2. **Keep secrets once**, in `~/.wirebay/secrets.env`.
3. **Sync** a small _launcher entry_ into each tool. The entry contains no secrets; it just says
   "run `wirebay run github`".

## Glossary

| Term                 | Meaning                                                                                                                             |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| **Server**           | An MCP server, like GitHub or Netlify. Defined by a JSON _definition_: how to start it and which secrets it needs.                  |
| **Preset**           | A server definition that ships with wirebay (`wirebay presets`).                                                                    |
| **Custom server**    | A definition you created with `wirebay add <name> --npx …`, stored in `~/.wirebay/servers/`.                                        |
| **Tool** (or client) | An AI app that uses MCP servers: Claude Code, Codex, Cursor… Described by a _manifest_ in the tools directory.                      |
| **Tools directory**  | `tools/<id>/`: one manifest (`tool.json`), guide and examples per tool, re-verified regularly.                                      |
| **Launcher**         | `wirebay run <server>`: what tool configs call. It loads that server's secrets and starts the real server.                          |
| **Desired state**    | `~/.wirebay/config.json`: which servers are enabled for which tools.                                                                |
| **Applied state**    | `~/.wirebay/state.json`: what wirebay actually wrote, with hashes.                                                                  |
| **Managed entry**    | A server entry in a tool file that wirebay wrote. wirebay only ever changes managed entries.                                        |
| **Drift**            | A managed entry that someone edited by hand since the last sync. wirebay won't overwrite it without `--force`.                      |
| **Conflict**         | A tool file already has an entry with the same name that wirebay didn't create.                                                     |
| **Sync**             | Make tool files match the desired state: add, update, and prune managed entries.                                                    |
| **Export**           | Write the files wirebay _would_ produce into `./wirebay-export/` without touching real configs.                                     |
| **Scope**            | `user`/global (your personal tool config, the default) or `project` (files in a repo, like `.mcp.json`, listed in `.wirebay.json`). |
| **Render mode**      | How entries call the launcher: `absolute` (node + script path, user scope), `portable` (`wirebay run …`, project scope), `npx`.     |

## Life of a command

```
wirebay add github to codex
  1. config.json: github → [codex]              (desired state)
  2. secrets.env: ask for GITHUB_PERSONAL_ACCESS_TOKEN if missing
  3. sync:
     render entry  { command: node, args: [wirebay, run, github] }
     read ~/.codex/config.toml, compare with state.json
     back up, write the managed block atomically, record hashes in state.json

codex starts → runs `node wirebay run github`
  4. launcher: load github definition + only its secrets
  5. spawn `npx mcp-remote https://api.githubcopilot.com/mcp/` with the token in the environment
  6. stdio passes straight through between Codex and the server
```

## Why a launcher instead of writing tokens into configs?

- **Security:** tool configs get synced, shared, screenshotted and committed. Keeping tokens out of
  them removes a whole class of leaks.
- **Rotation:** change the token once; every tool uses it next time it starts.
- **Portability:** the same entry works in every tool, whatever that tool supports for env vars.
