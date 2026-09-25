// Turns any reasonable phrasing into one canonical command.
//   wirebay sync github to codex cursor   →  { verb: sync, servers: [github], tools: [codex, cursor] }
//   wirebay push all                      →  { verb: sync, servers: all }
//   wirebay rm github from all            →  { verb: remove, servers: [github], tools: all }

import { UsageError } from "../core/errors.ts";
import { ALL_WORDS, EVERYTHING_WORDS, FILLER_WORDS, FLAGS, TARGETED_VERBS, TOOL_DIRECTION_WORDS, VERBS, type FlagSpec } from "./grammar.ts";

export type Selection = string[] | "all" | undefined;

export interface ParsedCommand {
  verb: string;
  servers: Selection;
  tools: Selection;
  /** Words that are neither servers nor tools (a new server name, a secrets subcommand, a key…). */
  rest: string[];
  flags: Record<string, string | string[] | boolean>;
}

export interface Vocabulary {
  isServer(name: string): boolean;
  /** Tool id for an id or alias, else undefined. */
  toolId(name: string): string | undefined;
  /** Every word worth suggesting in "did you mean". */
  words(): string[];
}

const byName = new Map<string, FlagSpec>();
const byShort = new Map<string, FlagSpec>();
for (const f of FLAGS) {
  byName.set(f.name, f);
  if (f.short) byShort.set(f.short, f);
}

function splitList(v: string): string[] {
  return v
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function setFlag(flags: ParsedCommand["flags"], spec: FlagSpec, value: string | boolean): void {
  if (spec.multiple && typeof value === "string") {
    const prev = (flags[spec.name] as string[] | undefined) ?? [];
    flags[spec.name] = [...prev, ...(["to", "from", "for", "server"].includes(spec.name) ? splitList(value) : [value])];
  } else {
    flags[spec.name] = value;
  }
}

/** Split argv into flags and positionals. */
export function splitArgs(argv: string[]): { positionals: string[]; flags: ParsedCommand["flags"] } {
  const flags: ParsedCommand["flags"] = {};
  const positionals: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a === "--") {
      positionals.push(...argv.slice(i + 1));
      break;
    }
    if (a.startsWith("--")) {
      const [rawName, inline] = a.slice(2).split(/=(.*)/s, 2) as [string, string | undefined];
      const spec = byName.get(rawName);
      if (!spec) throw new UsageError(`Unknown option --${rawName}.`, suggest(`--${rawName}`, FLAGS.map((f) => `--${f.name}`)));
      if (spec.value) {
        const value = inline ?? argv[++i];
        if (value === undefined) throw new UsageError(`--${spec.name} needs a value.`);
        setFlag(flags, spec, value);
      } else {
        setFlag(flags, spec, true);
      }
    } else if (/^-[A-Za-z]+$/.test(a)) {
      for (const ch of a.slice(1)) {
        const spec = byShort.get(ch);
        if (!spec) throw new UsageError(`Unknown option -${ch}.`);
        setFlag(flags, spec, true);
      }
    } else {
      positionals.push(a);
    }
  }
  return { positionals, flags };
}

export function parse(argv: string[], vocab: Vocabulary): ParsedCommand {
  const { positionals, flags } = splitArgs(argv);
  if (flags.version && positionals.length === 0) return { verb: "version", servers: undefined, tools: undefined, rest: [], flags };
  if (positionals.length === 0) return { verb: "help", servers: undefined, tools: undefined, rest: [], flags };

  const first = positionals[0]!.toLowerCase();
  const verb = VERBS[first];
  if (!verb) {
    throw new UsageError(`Unknown command "${positionals[0]}".`, suggest(first, Object.keys(VERBS)) ?? "Run `wirebay help` to see all commands.");
  }
  const words = positionals.slice(1);
  if (flags.help) return { verb: "help", servers: undefined, tools: undefined, rest: [verb], flags };
  if (!TARGETED_VERBS.has(verb)) return { verb, servers: undefined, tools: undefined, rest: words, flags };

  let servers: Selection;
  let tools: Selection;
  const rest: string[] = [];
  const addTo = (sel: Selection, v: string): Selection => (sel === "all" ? "all" : [...(sel ?? []), v]);
  let direction: "servers" | "tools" = "servers";

  for (const raw of words.flatMap((w) => w.split(",")).map((w) => w.trim()).filter(Boolean)) {
    const w = raw.toLowerCase();
    if (TOOL_DIRECTION_WORDS.has(w)) {
      direction = "tools";
      continue;
    }
    if (FILLER_WORDS.has(w)) continue;
    if (EVERYTHING_WORDS.has(w)) {
      servers = "all";
      tools = "all";
      continue;
    }
    if (ALL_WORDS.has(w)) {
      if (direction === "tools") tools = "all";
      else servers = "all";
      continue;
    }
    const toolId = vocab.toolId(w);
    if (toolId && !vocab.isServer(w)) {
      tools = addTo(tools, toolId);
      continue;
    }
    if (vocab.isServer(w)) {
      servers = addTo(servers, w);
      continue;
    }
    rest.push(raw);
  }

  for (const key of ["to", "from", "for"]) {
    for (const t of (flags[key] as string[] | undefined) ?? []) {
      if (ALL_WORDS.has(t.toLowerCase())) {
        tools = "all";
        continue;
      }
      const id = vocab.toolId(t.toLowerCase());
      if (!id) throw new UsageError(`Unknown tool "${t}".`, suggest(t, vocab.words()) ?? "Run `wirebay tools` to see supported tools.");
      tools = addTo(tools, id);
    }
  }
  for (const s of (flags.server as string[] | undefined) ?? []) servers = addTo(servers, s);
  if (flags["all-tools"]) tools = "all";
  if (flags["all-servers"]) servers = "all";
  if (flags.all) {
    if (servers && servers !== "all") tools = "all";
    else servers = "all";
  }

  // Anything left over is only allowed where a free word makes sense.
  const allowsFreeWords = verb === "add" || verb === "restore";
  if (rest.length && !allowsFreeWords) {
    const word = rest[0]!;
    throw new UsageError(
      `"${word}" is not a known server or tool.`,
      suggest(word, vocab.words()) ?? "Run `wirebay list` for your servers and `wirebay tools` for supported tools.",
    );
  }
  return { verb, servers, tools, rest, flags };
}

/** "did you mean …" based on edit distance. */
export function suggest(word: string, candidates: string[]): string | undefined {
  let best: { c: string; d: number } | undefined;
  for (const c of new Set(candidates)) {
    const d = distance(word.toLowerCase(), c.toLowerCase());
    if (!best || d < best.d) best = { c, d };
  }
  if (best && best.d <= Math.max(1, Math.floor(word.length / 3))) return `Did you mean "${best.c}"?`;
  return undefined;
}

/** Edit distance where swapping two neighbouring letters ("snyc" → "sync") counts as one edit. */
function distance(a: string, b: string): number {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array<number>(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) dp[0]![j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i]![j] = Math.min(dp[i - 1]![j]! + 1, dp[i]![j - 1]! + 1, dp[i - 1]![j - 1]! + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) dp[i]![j] = Math.min(dp[i]![j]!, dp[i - 2]![j - 2]! + 1);
    }
  }
  return dp[a.length]![b.length]!;
}

/** One line showing what a command was understood as. */
export function canonical(cmd: ParsedCommand): string {
  const sel = (s: Selection) => (s === "all" ? "all" : s ? `[${s.join(",")}]` : "default");
  const parts = [cmd.verb];
  if (TARGETED_VERBS.has(cmd.verb)) parts.push(`servers=${sel(cmd.servers)}`, `tools=${sel(cmd.tools)}`);
  if (cmd.rest.length) parts.push(`args=[${cmd.rest.join(",")}]`);
  return `→ ${parts.join(" ")}`;
}
