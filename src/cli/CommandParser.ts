/**
 * Turns any reasonable phrasing into one canonical command.
 *
 *     wirebay sync github to codex cursor   →  sync servers=[github] tools=[codex,cursor]
 *     wirebay push all                      →  sync servers=all
 *     wirebay rm github from all            →  remove servers=[github] tools=all
 * @module
 */

import { UsageError } from "../core/errors.ts";
import { ALL_WORDS, EVERYTHING_WORDS, FILLER_WORDS, FLAGS, type FlagSpec, TOOL_DIRECTION_WORDS } from "./Grammar.ts";
import { Suggester } from "./Suggester.ts";

/** A selection of servers or tools: explicit names, everything, or unspecified (use defaults). */
export type Selection = string[] | "all" | undefined;

/** Parsed option values. */
export type Flags = Record<string, string | string[] | boolean>;

/** A command line, understood. */
export interface ParsedCommand {
  /** Canonical verb, e.g. `sync`. */
  verb: string;
  servers: Selection;
  tools: Selection;
  /** Words that are neither servers nor tools (a new server name, a subcommand, a key…). */
  rest: string[];
  flags: Flags;
}

/** What the parser needs to know about the world to classify words. */
export interface Vocabulary {
  /** True when a server with this name exists. */
  isServer(name: string): boolean;
  /** Tool id for an id or alias, else `undefined`. */
  toolId(name: string): string | undefined;
  /** Every word worth suggesting in "did you mean". */
  words(): string[];
}

/** What the parser needs to know about verbs. */
export interface VerbTable {
  /** Canonical verb for a word (verb or alias), else `undefined`. */
  resolve(word: string): string | undefined;
  /** True when a verb's words are classified into servers and tools. */
  isTargeted(verb: string): boolean;
  /** True when a verb accepts free words (e.g. a new server name for `add`). */
  acceptsFreeWords(verb: string): boolean;
  /** Every verb and alias (for suggestions). */
  words(): string[];
}

/** Parses argv into a {@link ParsedCommand}. */
export class CommandParser {
  private static readonly byName = new Map(FLAGS.map((f) => [f.name, f]));
  private static readonly byShort = new Map(FLAGS.filter((f) => f.short).map((f) => [f.short!, f]));

  private readonly verbs: VerbTable;
  private readonly vocabulary: Vocabulary;

  constructor(verbs: VerbTable, vocabulary: Vocabulary) {
    this.verbs = verbs;
    this.vocabulary = vocabulary;
  }

  /**
   * Parse a command line (without the program name).
   * @throws {@link core/errors!UsageError} with a "did you mean" hint for unknown words and options.
   */
  parse(argv: string[]): ParsedCommand {
    const { positionals, flags } = CommandParser.split(argv);
    const empty = (verb: string, rest: string[] = []): ParsedCommand => ({ verb, servers: undefined, tools: undefined, rest, flags });
    if (flags.version && positionals.length === 0) return empty("version");
    if (positionals.length === 0) return empty("help");

    const first = positionals[0]!.toLowerCase();
    const verb = this.verbs.resolve(first);
    if (!verb) throw new UsageError(`Unknown command "${positionals[0]}".`, Suggester.suggest(first, this.verbs.words()) ?? "Run `wirebay help` to see all commands.");
    const words = positionals.slice(1);
    if (flags.help) return empty("help", [verb]);
    if (!this.verbs.isTargeted(verb)) return empty(verb, words);

    const cmd: ParsedCommand = { verb, servers: undefined, tools: undefined, rest: [], flags };
    this.classifyWords(cmd, words);
    this.applySelectionFlags(cmd);

    if (cmd.rest.length && !this.verbs.acceptsFreeWords(verb)) {
      const word = cmd.rest[0]!;
      throw new UsageError(
        `"${word}" is not a known server or tool.`,
        Suggester.suggest(word, this.vocabulary.words()) ?? "Run `wirebay list` for your servers and `wirebay tools` for supported tools.",
      );
    }
    return cmd;
  }

  /** One line showing what a command was understood as, e.g. `→ sync servers=[github] tools=all`. */
  describe(cmd: ParsedCommand): string {
    const sel = (s: Selection) => (s === "all" ? "all" : s ? `[${s.join(",")}]` : "default");
    const parts = [cmd.verb];
    if (this.verbs.isTargeted(cmd.verb)) parts.push(`servers=${sel(cmd.servers)}`, `tools=${sel(cmd.tools)}`);
    if (cmd.rest.length) parts.push(`args=[${cmd.rest.join(",")}]`);
    return `→ ${parts.join(" ")}`;
  }

  /** Split argv into options and positional words. */
  static split(argv: string[]): { positionals: string[]; flags: Flags } {
    const flags: Flags = {};
    const positionals: string[] = [];
    for (let i = 0; i < argv.length; i++) {
      const a = argv[i]!;
      if (a === "--") {
        positionals.push(...argv.slice(i + 1));
        break;
      }
      if (a.startsWith("--")) {
        const [name, inline] = a.slice(2).split(/=(.*)/s, 2) as [string, string | undefined];
        const spec = CommandParser.byName.get(name);
        if (!spec) throw new UsageError(`Unknown option --${name}.`, Suggester.suggest(`--${name}`, FLAGS.map((f) => `--${f.name}`)));
        if (spec.value) {
          const value = inline ?? argv[++i];
          if (value === undefined) throw new UsageError(`--${spec.name} needs a value.`);
          CommandParser.setFlag(flags, spec, value);
        } else {
          CommandParser.setFlag(flags, spec, true);
        }
      } else if (/^-[A-Za-z]+$/.test(a)) {
        for (const ch of a.slice(1)) {
          const spec = CommandParser.byShort.get(ch);
          if (!spec) throw new UsageError(`Unknown option -${ch}.`);
          CommandParser.setFlag(flags, spec, true);
        }
      } else {
        positionals.push(a);
      }
    }
    return { positionals, flags };
  }

  private static setFlag(flags: Flags, spec: FlagSpec, value: string | boolean): void {
    if (spec.multiple && typeof value === "string") {
      const prev = (flags[spec.name] as string[] | undefined) ?? [];
      const values = spec.list ? value.split(",").map((s) => s.trim()).filter(Boolean) : [value];
      flags[spec.name] = [...prev, ...values];
    } else {
      flags[spec.name] = value;
    }
  }

  /** Classify each word as a server, a tool, an `all`, a filler word, or a free word. */
  private classifyWords(cmd: ParsedCommand, words: string[]): void {
    let direction: "servers" | "tools" = "servers";
    for (const raw of words.flatMap((w) => w.split(",")).map((w) => w.trim()).filter(Boolean)) {
      const w = raw.toLowerCase();
      if (TOOL_DIRECTION_WORDS.has(w)) {
        direction = "tools";
      } else if (FILLER_WORDS.has(w)) {
        continue;
      } else if (EVERYTHING_WORDS.has(w)) {
        cmd.servers = "all";
        cmd.tools = "all";
      } else if (ALL_WORDS.has(w)) {
        if (direction === "tools") cmd.tools = "all";
        else cmd.servers = "all";
      } else if (this.vocabulary.toolId(w) && !this.vocabulary.isServer(w)) {
        cmd.tools = CommandParser.add(cmd.tools, this.vocabulary.toolId(w)!);
      } else if (this.vocabulary.isServer(w)) {
        cmd.servers = CommandParser.add(cmd.servers, w);
      } else {
        cmd.rest.push(raw);
      }
    }
  }

  /** Apply `--to/--from/--for/--server/--all…` on top of the words. */
  private applySelectionFlags(cmd: ParsedCommand): void {
    for (const key of ["to", "from", "for"]) {
      for (const t of (cmd.flags[key] as string[] | undefined) ?? []) {
        if (ALL_WORDS.has(t.toLowerCase())) {
          cmd.tools = "all";
          continue;
        }
        const id = this.vocabulary.toolId(t.toLowerCase());
        if (!id) throw new UsageError(`Unknown tool "${t}".`, Suggester.suggest(t, this.vocabulary.words()) ?? "Run `wirebay tools` to see supported tools.");
        cmd.tools = CommandParser.add(cmd.tools, id);
      }
    }
    for (const s of (cmd.flags.server as string[] | undefined) ?? []) cmd.servers = CommandParser.add(cmd.servers, s);
    if (cmd.flags["all-tools"]) cmd.tools = "all";
    if (cmd.flags["all-servers"]) cmd.servers = "all";
    if (cmd.flags.all) {
      if (cmd.servers && cmd.servers !== "all") cmd.tools = "all";
      else cmd.servers = "all";
    }
  }

  private static add(sel: Selection, value: string): Selection {
    return sel === "all" ? "all" : [...(sel ?? []), value];
  }
}
