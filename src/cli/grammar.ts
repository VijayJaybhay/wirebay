// The command grammar as data. Edit these tables to add verbs, aliases or flags;
// parse.ts contains the (small) logic that uses them.

/** Every spelling of a verb → its canonical name. */
export const VERBS: Record<string, string> = {
  init: "init",
  setup: "init",
  add: "add",
  install: "add",
  new: "add",
  sync: "sync",
  push: "sync",
  apply: "sync",
  deploy: "sync",
  export: "export",
  generate: "export",
  enable: "enable",
  on: "enable",
  disable: "disable",
  off: "disable",
  remove: "remove",
  rm: "remove",
  delete: "remove",
  uninstall: "remove",
  unsync: "unsync",
  detach: "unsync",
  list: "list",
  ls: "list",
  status: "list",
  tools: "tools",
  clients: "tools",
  presets: "presets",
  secrets: "secrets",
  secret: "secrets",
  keys: "secrets",
  doctor: "doctor",
  check: "doctor",
  restore: "restore",
  run: "run",
  help: "help",
  version: "version",
};

/** Verbs whose positionals are classified into servers and tools. */
export const TARGETED_VERBS = new Set(["add", "sync", "export", "enable", "disable", "remove", "unsync", "list", "doctor", "restore"]);

/** Words after which `all` means "all tools". */
export const TOOL_DIRECTION_WORDS = new Set(["to", "into", "on", "onto", "for", "in", "from"]);

/** Words that carry no meaning and are skipped. */
export const FILLER_WORDS = new Set(["and", "with", "&", "the", "server", "servers", "tool", "tools"]);

export const ALL_WORDS = new Set(["all", "*", "every"]);
export const EVERYTHING_WORDS = new Set(["everything"]);

export interface FlagSpec {
  name: string;
  short?: string;
  /** Takes a value. */
  value?: boolean;
  /** Can be given more than once (values are collected). */
  multiple?: boolean;
  description: string;
}

export const FLAGS: FlagSpec[] = [
  { name: "to", value: true, multiple: true, description: "Tool(s) to act on (comma-separated)" },
  { name: "from", value: true, multiple: true, description: "Tool(s) to remove from" },
  { name: "for", value: true, multiple: true, description: "Same as --to" },
  { name: "server", value: true, multiple: true, description: "Server(s) to act on" },
  { name: "all", description: "Every server (or every tool, when servers are named)" },
  { name: "all-tools", description: "Every installed tool" },
  { name: "all-servers", description: "Every added server" },
  { name: "scope", value: true, description: "user (default) or project" },
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
  { name: "timeout", value: true, description: "doctor: seconds to wait for each server (default 90)" },
  { name: "purge", description: "remove: also delete your custom server definition" },
  { name: "out", value: true, description: "export: output folder (default ./wirebay-export)" },
  { name: "help", short: "h", description: "Show help" },
  { name: "version", short: "v", description: "Show version" },
];
