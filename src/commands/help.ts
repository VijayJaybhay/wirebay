// `wirebay help [command]` and `wirebay --version`.

import { readFileSync } from "node:fs";
import path from "node:path";
import { FLAGS, VERBS } from "../cli/grammar.ts";
import { c, out } from "../cli/ui.ts";
import { packageRoot } from "../core/paths.ts";

export function version(): string {
  return (JSON.parse(readFileSync(path.join(packageRoot, "package.json"), "utf8")) as { version: string }).version;
}

export const COMMAND_HELP: Record<string, { usage: string; summary: string; examples: string[] }> = {
  init: { usage: "wirebay init", summary: "Create ~/.wirebay, the secrets file, and detect installed tools.", examples: ["wirebay init"] },
  add: {
    usage: "wirebay add <server> [to <tools>|all] [--npx|--uvx|--docker|--url|--command …]",
    summary: "Add a built-in or custom server, ask for its secrets, and sync it.",
    examples: [
      "wirebay add github to all",
      "wirebay add netlify to codex cursor",
      "wirebay add linear --npx @linear/mcp --secret LINEAR_API_KEY --to claude",
      "wirebay add sentry --url https://mcp.sentry.dev/mcp --oauth",
      "wirebay add github --variant docker",
    ],
  },
  sync: {
    usage: "wirebay sync [servers] [to <tools>|all] [--dry-run] [--force] [--scope project]",
    summary: "Make tool configs match wirebay's config. Adds, updates and removes only wirebay-managed entries.",
    examples: ["wirebay sync", "wirebay sync codex", "wirebay sync github to cursor vscode", "wirebay sync --dry-run"],
  },
  export: { usage: "wirebay export [tools] [--out dir]", summary: "Write ready-to-copy config files without touching real ones.", examples: ["wirebay export", "wirebay export cursor"] },
  enable: { usage: "wirebay enable <servers> for <tools>", summary: "Turn servers on for more tools, then sync.", examples: ["wirebay enable netlify for cursor vscode"] },
  disable: { usage: "wirebay disable <servers> from <tools>", summary: "Turn servers off for some tools, then sync.", examples: ["wirebay disable aws-api from desktop"] },
  remove: {
    usage: "wirebay remove <servers> [from <tools>] [--purge]",
    summary: "Remove servers from some tools, or from wirebay and every tool.",
    examples: ["wirebay remove github from cursor", "wirebay remove github"],
  },
  unsync: { usage: "wirebay unsync [tools]", summary: "Remove every wirebay-managed entry from tools (config is kept).", examples: ["wirebay unsync all", "wirebay unsync codex"] },
  list: { usage: "wirebay list [server|tool] [--json]", summary: "Show which servers are synced to which tools.", examples: ["wirebay list", "wirebay ls codex"] },
  tools: {
    usage: "wirebay tools [--stale [--days N]] | tools verify [id] | tools index",
    summary: "Supported AI tools, whether they are installed, and where their config lives.",
    examples: ["wirebay tools", "wirebay tools --stale", "wirebay tools verify codex"],
  },
  presets: { usage: "wirebay presets [--stale]", summary: "Built-in servers you can add by name.", examples: ["wirebay presets"] },
  secrets: {
    usage: "wirebay secrets set|unset|list|path|edit [KEY]",
    summary: "Manage the central secrets file, one key at a time. Values are never printed.",
    examples: ["wirebay secrets set GITHUB_PERSONAL_ACCESS_TOKEN", "echo $TOKEN | wirebay secrets set NETLIFY_PERSONAL_ACCESS_TOKEN --stdin", "wirebay secrets list"],
  },
  doctor: {
    usage: "wirebay doctor [servers|tools] [--offline] [--json]",
    summary: "Check prerequisites, secrets, permissions, tool files, and start each server for a real MCP handshake.",
    examples: ["wirebay doctor", "wirebay doctor github", "wirebay doctor --offline"],
  },
  restore: { usage: "wirebay restore <tool> [--list | <backup-id>]", summary: "Roll a tool's config back to a backup.", examples: ["wirebay restore codex --list", "wirebay restore codex"] },
  run: { usage: "wirebay run <server>", summary: "Start a server with its secrets (this is what tool configs call).", examples: ["wirebay run github"] },
};

export function help(topic?: string): number {
  const verb = topic ? (VERBS[topic] ?? topic) : undefined;
  if (verb && COMMAND_HELP[verb]) {
    const h = COMMAND_HELP[verb]!;
    const aliases = Object.entries(VERBS)
      .filter(([k, v]) => v === verb && k !== verb)
      .map(([k]) => k);
    out(c.bold(h.usage));
    out(`\n${h.summary}`);
    if (aliases.length) out(c.dim(`\nAlso: ${aliases.join(", ")}`));
    out(`\n${c.bold("Examples")}`);
    for (const e of h.examples) out(`  ${e}`);
    return 0;
  }
  out(`${c.bold("wirebay")} ${c.dim(version())}: define MCP servers once, keep secrets in one place, sync to every AI tool.\n`);
  out(c.bold("Everyday"));
  out("  wirebay add github to all          add a server and sync it everywhere");
  out("  wirebay sync [servers] [to tools]  make tool configs match");
  out("  wirebay list                       what is synced where");
  out("  wirebay secrets set KEY            store a token (asked for, never echoed)");
  out("  wirebay doctor                     check everything works\n");
  out(c.bold("All commands"));
  for (const [name, h] of Object.entries(COMMAND_HELP)) out(`  ${name.padEnd(9)} ${h.summary}`);
  out(`\n${c.bold("Say it your way")}: sync github to codex · push all · rm github from cursor · add netlify on claude`);
  out(`${c.bold("Common options")}: ${FLAGS.filter((f) => ["dry-run", "yes", "force", "json", "scope"].includes(f.name)).map((f) => `--${f.name}${f.short ? `/-${f.short}` : ""}`).join("  ")}`);
  out(c.dim(`\nMore: wirebay help <command> · https://github.com/VijayJaybhay/wirebay#readme`));
  return 0;
}
