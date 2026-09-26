# Configuration

## The `~/.wirebay` folder

| Path                   | What                                                                       | Edited by                                        |
| ---------------------- | -------------------------------------------------------------------------- | ------------------------------------------------ |
| `config.json`          | Desired state: which servers go to which tools, defaults, executable paths | `add`, `enable`, `disable`, `remove`, or by hand |
| `secrets.env`          | All secrets ([secrets](secrets.md))                                        | `wirebay secrets …` or by hand                   |
| `servers/<name>.json`  | Your custom servers and preset overrides                                   | `add`, or by hand                                |
| `tools/<id>/tool.json` | Your own tool manifests or overrides                                       | by hand                                          |
| `credentials/`         | Secret files, e.g. service-account JSON                                    | you                                              |
| `state.json`           | What wirebay wrote into each tool file (hashes)                            | wirebay only                                     |
| `backups/<tool>/`      | The last 20 versions of each tool file                                     | wirebay only                                     |
| `logs/<server>.log`    | Launcher logs (secrets redacted, rotated at 1 MB)                          | wirebay only                                     |

`WIREBAY_HOME` moves this folder. When it's set, entries written into tool configs include
`WIREBAY_HOME`, so the launcher finds the same folder.

## `config.json`

```json
{
  "$schema": "https://raw.githubusercontent.com/pragnalabs-ai/wirebay/main/schemas/config.schema.json",
  "version": 1,
  "defaultTools": ["claude-code", "codex", "cursor"],
  "defaultScope": "user",
  "renderMode": "auto",
  "paths": { "npx": "C:\\Program Files\\nodejs\\npx.cmd", "uvx": "C:\\Users\\me\\.local\\bin\\uvx.exe" },
  "servers": {
    "github": { "tools": ["claude-code", "codex", "cursor"] },
    "netlify": { "tools": ["cursor"] }
  }
}
```

| Field          | Meaning                                                                                                                           |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `defaultTools` | Tools a server is enabled for when `add` gets no tool names. Set by `init` to the detected tools.                                 |
| `defaultScope` | Where `add`/`enable`/`disable`/`remove` write: `user` (global) or `project`. `--global`, `--project` and `--dir` override it.     |
| `renderMode`   | `auto` (absolute for user scope, portable for project scope), `absolute`, or `portable`.                                          |
| `paths`        | Absolute paths to `npx`, `uvx`, `docker`, … Useful because GUI apps don't inherit your shell `PATH`. Refreshed by `wirebay init`. |
| `servers`      | Server name → the tools it's enabled for (global scope).                                                                          |

After editing by hand, run `wirebay sync`.

## Project config: `<project>/.wirebay.json`

Servers for one project live in the project, not in `~/.wirebay`. The file has the same
`servers` map as `config.json` and is safe to commit. It is created by `wirebay init --project`
or the first `wirebay add … --project`, and checked against
[`schemas/project.schema.json`](../schemas/project.schema.json) when read. See
[global vs project servers](teams.md).

## Render modes

| Mode       | Entry looks like                                                                                         | Used for                                                              |
| ---------- | -------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| `absolute` | `"command": "/usr/local/bin/node", "args": ["/…/wirebay/dist/cli.js", "run", "github"]`                  | User scope. Most robust: no PATH lookups, no Windows `.cmd` problems. |
| `portable` | `"command": "wirebay", "args": ["run", "github"]` (`cmd /c wirebay …` on Windows for tools that need it) | Project scope (committed files), so no machine-specific paths.        |
| `npx`      | `"command": "npx", "args": ["-y", "@pragnalabs.ai/wirebay@latest", "run", "github"]`                     | Automatic when wirebay itself runs from npx.                          |

## Overrides

- **Change a preset:** create `~/.wirebay/servers/<preset>.json` with just the changed fields. See
  [custom servers](servers/custom-servers.md#overriding-a-preset).
- **Change a tool** (for example VS Code Insiders' path, or extra entry fields): copy
  `tools/<id>/tool.json` from the repo to `~/.wirebay/tools/<id>/tool.json` and edit it. Your copy
  replaces the built-in one.
- **Add a tool wirebay doesn't know yet:** put a new manifest in `~/.wirebay/tools/<id>/tool.json`
  (see [add a tool](contributing/add-a-tool.md)), and please contribute it back.

## Environment variables

| Variable                   | Effect                                                                       |
| -------------------------- | ---------------------------------------------------------------------------- |
| `WIREBAY_HOME`             | Location of the `.wirebay` folder                                            |
| `WIREBAY_USER_HOME`        | Pretend this is the home folder (for testing; affects tool config paths too) |
| `NO_COLOR` / `FORCE_COLOR` | Disable or force colours                                                     |
| `CI`                       | Never prompt                                                                 |
