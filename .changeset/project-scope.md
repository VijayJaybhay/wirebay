---
"wirebay": minor
---

Project-level MCP servers: add, sync, list, enable, disable, remove, unsync and export now take `--global` (default), `--project`, or `--dir <path>` to apply servers to one project's tool configs (`.mcp.json`, `.cursor/mcp.json`, `.vscode/mcp.json`, …) instead of globally. A project's servers are kept in a committable `<project>/.wirebay.json` (validated against `schemas/project.schema.json`), found from any subfolder. `wirebay init --project` creates it. Inside a project, `sync` and `list` cover both global and project servers. Tools without project-level config are skipped with a hint.
