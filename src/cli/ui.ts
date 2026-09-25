// Terminal output helpers: colors (respecting NO_COLOR), simple tables, prompts.
// Human output goes to stdout; the "→ canonical command" echo and warnings go to stderr.

import { styleText } from "node:util";

type Style = Parameters<typeof styleText>[0];

const colorOn = () => !process.env.NO_COLOR && (process.stdout.isTTY || !!process.env.FORCE_COLOR);

export function paint(style: Style, text: string): string {
  return colorOn() ? styleText(style, text) : text;
}

export const c = {
  ok: (t: string) => paint("green", t),
  warn: (t: string) => paint("yellow", t),
  err: (t: string) => paint("red", t),
  dim: (t: string) => paint("dim", t),
  bold: (t: string) => paint("bold", t),
  cyan: (t: string) => paint("cyan", t),
};

export function out(line = ""): void {
  process.stdout.write(line + "\n");
}

export function note(line: string): void {
  process.stderr.write(line + "\n");
}

export function printJson(value: unknown): void {
  process.stdout.write(JSON.stringify(value, null, 2) + "\n");
}

/** Visible width (ignores ANSI color codes). */
function width(s: string): number {
  return s.replace(/\x1b\[[0-9;]*m/g, "").length;
}

export function table(headers: string[], rows: string[][]): string {
  const widths = headers.map((h, i) => Math.max(width(h), ...rows.map((r) => width(r[i] ?? ""))));
  const line = (cells: string[]) => cells.map((cell, i) => cell + " ".repeat(widths[i]! - width(cell))).join("  ").trimEnd();
  return [c.bold(line(headers)), ...rows.map(line)].join("\n");
}

/** Prompts are allowed only in an interactive terminal outside CI. */
export function canPrompt(flags: Record<string, unknown> = {}): boolean {
  return !!process.stdin.isTTY && !!process.stdout.isTTY && !process.env.CI && !flags["no-prompt"];
}

export async function confirm(message: string, flags: Record<string, unknown>): Promise<boolean> {
  if (flags.yes) return true;
  if (!canPrompt(flags)) return false;
  const p = await import("@clack/prompts");
  const answer = await p.confirm({ message });
  return answer === true;
}

export async function askSecret(message: string): Promise<string | undefined> {
  const p = await import("@clack/prompts");
  const answer = await p.password({ message, mask: "•" });
  if (p.isCancel(answer)) return undefined;
  return String(answer ?? "");
}

export async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString("utf8").replace(/\r?\n$/, "");
}
