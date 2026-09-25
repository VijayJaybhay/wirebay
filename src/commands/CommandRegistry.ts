/**
 * Collects commands and answers "which command is this word?".
 * @module
 */

import type { VerbTable } from "../cli/CommandParser.ts";
import type { Command } from "./Command.ts";

/** Registry of commands, keyed by name and alias. Also serves as the parser's verb table. */
export class CommandRegistry implements VerbTable {
  private readonly commands: Command[] = [];
  private readonly byWord = new Map<string, Command>();

  /**
   * Add a command.
   * @throws Error when a name or alias is already taken (a programming mistake).
   */
  register(command: Command): this {
    for (const word of [command.name, ...command.aliases]) {
      if (this.byWord.has(word)) throw new Error(`Command word "${word}" is registered twice`);
      this.byWord.set(word, command);
    }
    this.commands.push(command);
    return this;
  }

  /** The command for a verb or alias. */
  find(word: string): Command | undefined {
    return this.byWord.get(word.toLowerCase());
  }

  /** Every registered command, in registration order. */
  all(): readonly Command[] {
    return this.commands;
  }

  resolve(word: string): string | undefined {
    return this.find(word)?.name;
  }

  isTargeted(verb: string): boolean {
    return this.find(verb)?.targeted ?? false;
  }

  acceptsFreeWords(verb: string): boolean {
    return this.find(verb)?.acceptsFreeWords ?? false;
  }

  words(): string[] {
    return [...this.byWord.keys()];
  }
}
