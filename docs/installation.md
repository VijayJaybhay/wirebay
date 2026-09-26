# Installation

## Requirements

| Needed for                                                        | What                                                                                |
| ----------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| wirebay itself                                                    | Node.js **24 or newer**                                                             |
| npm-based servers (GitHub remote, Netlify, Firebase, most others) | `npx` (comes with Node.js)                                                          |
| Python-based servers (AWS)                                        | [uv](https://docs.astral.sh/uv/getting-started/installation/), which provides `uvx` |
| Docker-based servers (GitHub docker variant, …)                   | Docker Desktop / Docker Engine                                                      |

## Global install (recommended)

```bash
npm install -g @pragnalabs.ai/wirebay
wirebay init
```

Tool configs then point at a stable path: your Node binary plus wirebay's installed script.

## Without installing (npx)

```bash
npx @pragnalabs.ai/wirebay init
npx @pragnalabs.ai/wirebay add github to all
```

This works, but the npx cache path changes over time. When wirebay notices it is running from npx,
it writes `npx -y @pragnalabs.ai/wirebay@latest run <server>` into tool configs instead of an absolute path.
That is slower to start and needs network access on first run, so a global install is better.

## Per OS

**Windows:** install Node.js from nodejs.org (or `winget install OpenJS.NodeJS.LTS`) and uv with
`winget install astral-sh.uv`. wirebay runs `npx` through Node directly, so no `cmd` window flashes.

**macOS:** `brew install node uv`. GUI apps such as Claude Desktop don't see your shell PATH; run
`wirebay init` from a terminal so it records the absolute paths of `npx`, `uvx` and `docker`.

**Linux:** use your package manager or nvm/fnm for Node.js and the uv installer for uv. Same PATH
note as macOS for desktop apps.

## Upgrading

```bash
npm install -g @pragnalabs.ai/wirebay@latest
wirebay sync          # refresh entries if paths changed
wirebay doctor
```

Your `~/.wirebay` folder (config, secrets, backups) is never touched by upgrades.

If you upgrade **Node.js** (for example with nvm), the node path inside tool configs can go stale.
`wirebay doctor` detects this, and `wirebay sync --force` rewrites the entries.

## Uninstalling

```bash
wirebay unsync all        # remove every entry wirebay added to your tools
npm rm -g @pragnalabs.ai/wirebay
```

`~/.wirebay` is left in place so you don't lose secrets by accident. Delete it yourself if you're sure.
