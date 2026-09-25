// User-facing errors. Every error says what went wrong and how to fix it.

export const EXIT = {
  ok: 0,
  error: 1,
  usage: 2,
  doctorProblems: 3,
  conflict: 4,
} as const;

export class WirebayError extends Error {
  readonly exitCode: number;
  readonly hint?: string;

  constructor(message: string, opts: { hint?: string; exitCode?: number } = {}) {
    super(message);
    this.name = "WirebayError";
    this.hint = opts.hint;
    this.exitCode = opts.exitCode ?? EXIT.error;
  }
}

export class UsageError extends WirebayError {
  constructor(message: string, hint?: string) {
    super(message, { hint, exitCode: EXIT.usage });
    this.name = "UsageError";
  }
}
