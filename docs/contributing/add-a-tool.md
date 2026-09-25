# Add a tool (AI coding tool / MCP client)

Supporting a new tool is usually **JSON + Markdown only**. The generic adapter reads your manifest
and handles reading, merging, backups and tests.

## 1. Research the tool's MCP config

From the tool's **official docs** (link them in the manifest), find:

- [ ] Config file path for each OS (Windows, macOS, Linux) and each scope (user / project)
- [ ] Format: JSON, JSONC (comments allowed), TOML or YAML
- [ ] The key servers live under (`mcpServers`, `servers`, `mcp_servers`, `mcp.servers`, …)
- [ ] The shape of one stdio entry (`command`, `args`, `env`, a `type` field? extra fields?)
- [ ] Whether it can start Windows `.cmd` shims directly (most can't)
- [ ] Whether it needs a restart to pick up changes
- [ ] How to see connected servers inside the tool (for the guide)
- [ ] A command that proves it's installed (`cursor`, `code`, …) or a folder it creates

## 2. Scaffold

```bash
npm run new:tool -- windsurf --name "Windsurf" --path "~/.codeium/windsurf/mcp_config.json"
```

This creates `tools/windsurf/tool.json` and `GUIDE.md` from `tools/_template/`.

## 3. Fill in `tool.json`

Your editor autocompletes and validates it through `"$schema"`. The important fields:

```jsonc
{
  "id": "windsurf", // lowercase, also the folder name
  "name": "Windsurf",
  "aliases": ["codeium"], // extra names accepted in commands
  "docs": { "mcp": "https://…" }, // official MCP docs (required for maintenance)
  "detect": { "commands": ["windsurf"], "paths": ["~/.codeium/windsurf"] },
  "configs": {
    "user": { "path": "~/.codeium/windsurf/mcp_config.json", "createIfMissing": true },
    // "project": { "path": "{cwd}/.windsurf/mcp.json" }
  },
  "format": "json", // json | jsonc | toml | yaml
  "rootKey": "mcpServers", // dots for nesting: "mcp.servers"
  "mergeStrategy": "edit", // "managed-block" for TOML
  "entry": { "stdio": { "command": "{command}", "args": "{args}", "env": "{env}" } },
  "supports": { "stdio": true, "http": true, "envExpansion": false, "cmdShims": false },
  "restartRequired": false,
  "status": "beta", // beta until verified by a second person
  "lastVerified": "2026-09-25",
}
```

**Path placeholders:**

- `~`: home
- `{appdata}`: `%APPDATA%` / `~/Library/Application Support` / `~/.config`
- `{config}`: `~/.config`, or `%APPDATA%` on Windows
- `{cwd}`: the project folder
- `${ENV:-fallback}`: an environment variable, with a fallback

For per-OS paths, use `{ "win32": "…", "darwin": "…", "linux": "…" }`.

**Entry template:** wirebay fills in these placeholders:

- `{command}` and `{args}`
- `{env}`, omitted when empty
- `{commandLine}`, which is `[command, ...args]` for tools like opencode
- `{name}`, the server name

Root keys use dots for nesting. Write `\\.` for a literal dot, as in `"amp\\.mcpServers"`. Put fixed extra fields in `entry.extra`, e.g. `{ "startup_timeout_sec": 60 }`.

## 4. Write `GUIDE.md`

Keep the sections from the template: _Where the config lives_, _How wirebay syncs it_, _Doing it by
hand_, _Verify_, _Quirks_, _Changelog_.

## 5. Generate, validate, test

```bash
npm run gen:docs      # renders tools/windsurf/examples/, updates tools/INDEX.md and README
npm run validate
npm test              # snapshot tests pick up your tool automatically
node src/cli.ts tools verify windsurf
```

Review the files in `examples/` carefully: they are exactly what wirebay will write.

## 6. Try it for real (safely)

```bash
export WIREBAY_USER_HOME=/tmp/wb WIREBAY_HOME=/tmp/wb/.wirebay
node src/cli.ts init
node src/cli.ts add aws-docs to windsurf --include-missing
cat /tmp/wb/.codeium/windsurf/mcp_config.json
```

Then, if you have the tool installed, sync to your real config and check that the server appears
in the tool.

## 7. Open a PR

Add a changeset (`npx changeset`, patch) and fill in the PR checklist.

## When JSON isn't enough

Some tools need code, for example to go through the tool's own CLI or to write a proprietary format.

- **To change how a tool is written:** subclass `ToolAdapter` (`src/core/adapters/ToolAdapter.ts`)
  and override only the step that differs, usually `commit`. `ClaudeCodeAdapter` is the example.
  Register the subclass in `AdapterFactory.overrides` and set `"adapter": "<id>"` in the manifest.
- **For a new file format:** implement `ConfigFormat` and register it in `ConfigFormatFactory`.

Please open an issue first so we can discuss it.
