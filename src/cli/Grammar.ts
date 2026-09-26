/**
 * The command grammar as data: filler words, `all` words and flags. Verbs and their aliases
 * are declared by each command class and collected by the command registry.
 * @module
 */

/** Words after which `all` means "all tools". */
export const TOOL_DIRECTION_WORDS: ReadonlySet<string> = new Set(["to", "into", "on", "onto", "for", "in", "from"]);

/** Words that carry no meaning and are skipped. */
export const FILLER_WORDS: ReadonlySet<string> = new Set(["and", "with", "&", "the", "server", "servers", "tool", "tools"]);

/** Words meaning "every server" (or "every tool" after a direction word). */
export const ALL_WORDS: ReadonlySet<string> = new Set(["all", "*", "every"]);

/** Words meaning "every server and every tool". */
export const EVERYTHING_WORDS: ReadonlySet<string> = new Set(["everything"]);

/** A command-line option. */
export interface FlagSpec {
  name: string;
  /** One-letter form, e.g. `n` for `-n`. */
  short?: string;
  /** Takes a value. */
  value?: boolean;
  /** Can be repeated; values are collected into an array. */
  multiple?: boolean;
  /** Values may be comma-separated lists (`--to codex,cursor`). */
  list?: boolean;
  description: string;
}

/** Every option wirebay understands. */
export const FLAGS: readonly FlagSpec[] = [
  { name: "to", value: true, multiple: true, list: true, description: "Tool(s) to act on (comma-separated)" },
  { name: "from", value: true, multiple: true, list: true, description: "Tool(s) to remove from" },
  { name: "for", value: true, multiple: true, list: true, description: "Same as --to" },
  { name: "server", value: true, multiple: true, list: true, description: "Server(s) to act on" },
  { name: "all", description: "Every server (or every tool, when servers are named)" },
  { name: "all-tools", description: "Every installed tool" },
  { name: "all-servers", description: "Every added server" },
  { name: "global", description: "Apply to the tools' global (user-level) config (the default)" },
  { name: "project", description: "Apply to this project's tool configs (.mcp.json, .cursor/mcp.json, …) via .wirebay.json" },
  { name: "dir", value: true, description: "Apply to the project in this folder (implies --project)" },
  { name: "scope", value: true, description: "user or project (same as --global / --project)" },
  { name: "dry-run", short: "n", description: "Show what would change, change nothing" },
  { name: "yes", short: "y", description: "Don't ask for confirmation" },
  { name: "force", description: "Overwrite entries that were edited by hand or not created by wirebay" },
  { name: "json", description: "Machine-readable output" },
  { name: "include-missing", description: "Also write configs for tools that don't look installed" },
  { name: "no-sync", description: "Only update wirebay's config; don't touch tool files" },
  { name: "npx", value: true, description: "add: run an npm package with npx" },
  { name: "uvx", value: true, description: "add: run a Python package with uvx" },
  { name: "docker", value: true, description: "add: run a Docker image" },
  { name: "url", value: true, description: "add: connect to a remote (HTTP) MCP server" },
  { name: "command", value: true, description: "add: run any executable" },
  { name: "arg", value: true, multiple: true, description: "add: extra argument for the server (repeatable)" },
  { name: "secret", value: true, multiple: true, description: "add: secret key the server needs (repeatable)" },
  { name: "optional-secret", value: true, multiple: true, description: "add: optional secret key (repeatable)" },
  { name: "env", value: true, multiple: true, description: "add: non-secret KEY=value (repeatable)" },
  { name: "header", value: true, multiple: true, description: "add: non-secret HTTP header 'Name: value' (repeatable)" },
  { name: "oauth", description: "add: remote server uses browser OAuth" },
  { name: "variant", value: true, description: "add: use a preset variant (e.g. github --variant docker)" },
  { name: "description", value: true, description: "add: one-line description" },
  { name: "no-prompt", description: "Never prompt (also automatic without a TTY or in CI)" },
  { name: "stdin", description: "secrets set: read the value from stdin" },
  { name: "stale", description: "tools/presets: only entries due for re-verification" },
  { name: "days", value: true, description: "tools/presets --stale: age threshold (default 90)" },
  { name: "list", description: "restore: list backups" },
  { name: "offline", description: "doctor: skip starting servers" },
  { name: "fix", description: "doctor: repair what it can (asks first; --yes to skip, --dry-run to preview)" },
  { name: "timeout", value: true, description: "doctor: seconds to wait for each server (default 90)" },
  { name: "purge", description: "remove: also delete your custom server definition" },
  { name: "out", value: true, description: "export: output folder (default ./wirebay-export)" },
  { name: "help", short: "h", description: "Show help" },
  { name: "version", short: "v", description: "Show version" },
];
