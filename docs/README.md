# wirebay documentation

## Using wirebay

| Guide                                 | For                                                                    |
| ------------------------------------- | ---------------------------------------------------------------------- |
| [Getting started](getting-started.md) | Install → first server → verify, in 5 minutes                          |
| [Installation](installation.md)       | Global vs npx, prerequisites per OS, upgrading, uninstalling           |
| [Concepts](concepts.md)               | Servers, tools, presets, the launcher, managed entries, and a glossary |
| [CLI reference](cli-reference.md)     | Every command, option and exit code                                    |
| [Command grammar](command-grammar.md) | All the ways to phrase a command                                       |
| [Secrets](secrets.md)                 | The secrets file, commands, rotation, credentials folder               |
| [Configuration](configuration.md)     | `~/.wirebay` layout, `config.json`, overrides, render modes            |
| [Teams & project scope](teams.md)     | Sharing `.mcp.json` / `.vscode/mcp.json` in a repo                     |
| [Security model](security.md)         | What wirebay protects against and what it doesn't                      |
| [Troubleshooting](troubleshooting.md) | Common problems and fixes                                              |
| [FAQ](faq.md)                         | Short answers                                                          |

## Servers and tools

- [Server guides](servers/README.md): GitHub, Netlify, Firebase, AWS, custom servers
- [Tools directory](../tools/INDEX.md): Claude Code, Claude Desktop, Codex, Cursor, VS Code, Gemini CLI

## Contributing

| Guide                                                              | For                                                                   |
| ------------------------------------------------------------------ | --------------------------------------------------------------------- |
| [Add a tool](contributing/add-a-tool.md)                           | Support a new AI coding tool (JSON + Markdown)                        |
| [Add a server](contributing/add-a-server.md)                       | Add a built-in server preset (JSON + Markdown)                        |
| [Maintaining the directory](contributing/maintaining-directory.md) | Re-verifying tools and presets                                        |
| [Code guide](contributing/code-guide.md)                           | How the code is organised and written                                 |
| [Testing](contributing/testing.md)                                 | Test suites and how to add tests                                      |
| [Releasing](contributing/releasing.md)                             | Changesets and npm publishing                                         |
| [Architecture](architecture.md)                                    | Layers, key classes and data flow (API reference: `npm run docs:api`) |
| [Roadmap](roadmap.md)                                              | What's next                                                           |
