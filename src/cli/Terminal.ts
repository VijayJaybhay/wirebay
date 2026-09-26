/**
 * Terminal output and input: colours (respecting `NO_COLOR`), tables, prompts, stdin, progress.
 * Human output goes to stdout; notes, warnings and the progress line go to stderr.
 * @module
 */

import { stripVTControlCharacters, styleText } from "node:util";
import { Spinner } from "./Spinner.ts";

type Style = Parameters<typeof styleText>[0];

/** Flags that affect prompting. */
export interface PromptFlags {
  yes?: unknown;
  "no-prompt"?: unknown;
  [key: string]: unknown;
}

/** Wraps stdout/stderr/stdin so commands can be tested and output stays consistent. */
export class Terminal {
  private readonly stdout: NodeJS.WriteStream;
  private readonly stderr: NodeJS.WriteStream;
  private readonly env: NodeJS.ProcessEnv;
  private readonly spinner: Spinner;

  constructor(
    stdout: NodeJS.WriteStream = process.stdout,
    stderr: NodeJS.WriteStream = process.stderr,
    env: NodeJS.ProcessEnv = process.env,
  ) {
    this.stdout = stdout;
    this.stderr = stderr;
    this.env = env;
    this.spinner = new Spinner(stderr, stderr.isTTY && env.CI === undefined);
  }

  /** Print a line to stdout. */
  out(line = ""): void {
    this.spinner.clear();
    this.stdout.write(line + "\n");
    this.spinner.redraw();
  }

  /** Print a line to stderr (notes, warnings, the canonical-command echo). */
  note(line: string): void {
    this.spinner.clear();
    this.stderr.write(line + "\n");
    this.spinner.redraw();
  }

  /**
   * Show a progress line for a slow step (only in an interactive terminal). Call `update` to
   * change the message and `stop` when done; ordinary output can be printed in between.
   * @example
   * const progress = terminal.progress("Starting github…");
   * await start();
   * progress.stop();
   */
  progress(text: string): Spinner {
    return this.spinner.start(text);
  }

  /** Print a value as pretty JSON to stdout (for `--json`). */
  json(value: unknown): void {
    this.stdout.write(JSON.stringify(value, null, 2) + "\n");
  }

  /** Green text. */
  ok(t: string): string {
    return this.paint("green", t);
  }
  /** Yellow text. */
  warn(t: string): string {
    return this.paint("yellow", t);
  }
  /** Red text. */
  err(t: string): string {
    return this.paint("red", t);
  }
  /** Dimmed text. */
  dim(t: string): string {
    return this.paint("dim", t);
  }
  /** Bold text. */
  bold(t: string): string {
    return this.paint("bold", t);
  }
  /** Cyan text. */
  cyan(t: string): string {
    return this.paint("cyan", t);
  }

  /** Render a simple aligned table (colour codes are ignored when measuring widths). */
  table(headers: string[], rows: string[][]): string {
    const width = (s: string): number => stripVTControlCharacters(s).length;
    const widths = headers.map((h, i) => Math.max(width(h), ...rows.map((r) => width(r[i] ?? ""))));
    const line = (cells: string[]): string =>
      cells
        .map((cell, i) => cell + " ".repeat(Math.max(0, (widths[i] ?? 0) - width(cell))))
        .join("  ")
        .trimEnd();
    return [this.bold(line(headers)), ...rows.map(line)].join("\n");
  }

  /** Prompts are allowed only in an interactive terminal outside CI, and not with `--no-prompt`. */
  canPrompt(flags: PromptFlags = {}): boolean {
    return process.stdin.isTTY && this.stdout.isTTY && this.env.CI === undefined && !flags["no-prompt"];
  }

  /** Ask a yes/no question. `--yes` answers yes; without a TTY the answer is no. */
  async confirm(message: string, flags: PromptFlags): Promise<boolean> {
    if (flags.yes) return true;
    if (!this.canPrompt(flags)) return false;
    this.spinner.stop();
    const p = await import("@clack/prompts");
    return (await p.confirm({ message })) === true;
  }

  /** Ask for a secret with hidden input. Returns `undefined` when cancelled. */
  async askSecret(message: string): Promise<string | undefined> {
    this.spinner.stop();
    const p = await import("@clack/prompts");
    const answer = await p.password({ message, mask: "•" });
    return p.isCancel(answer) ? undefined : answer;
  }

  /** Read all of stdin (for `--stdin`), without the trailing newline. */
  async readStdin(): Promise<string> {
    const chunks: Buffer[] = [];
    for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
    return Buffer.concat(chunks)
      .toString("utf8")
      .replace(/\r?\n$/, "");
  }

  private paint(style: Style, text: string): string {
    const colour = this.env.NO_COLOR === undefined && (this.stdout.isTTY || this.env.FORCE_COLOR !== undefined);
    return colour ? styleText(style, text) : text;
  }
}
