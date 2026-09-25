# Goose

Block's open-source agent (CLI and desktop). Official docs: https://goose-docs.ai/docs/guides/config-files/

## Where the config lives

| OS            | File                                       |
| ------------- | ------------------------------------------ |
| macOS / Linux | `~/.config/goose/config.yaml`              |
| Windows       | `%APPDATA%\Block\goose\config\config.yaml` |

Servers are **extensions** under `extensions:` (YAML). Each entry repeats its own `name`, uses
`cmd` rather than `command`, and `envs` for environment values. Comments in the file are kept.

## How wirebay syncs it

```bash
wirebay add github to goose
```

## Doing it by hand

```yaml
extensions:
  github:
    type: stdio
    name: github
    enabled: true
    cmd: wirebay
    args: [run, github]
    envs: {}
    timeout: 300
```

On Windows, entries written by hand usually need `cmd /c wirebay run <server>`; wirebay's own entries call `node.exe` directly.

## Verify

Start a new session. `goose info -v` shows the config path and enabled extensions.

## Quirks

- Goose reads config when a session starts, so start a new session after syncing.

## Changelog

- 2026-09-25: first version, from the official docs linked above.
