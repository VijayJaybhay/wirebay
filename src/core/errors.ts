/**
 * User-facing error types and process exit codes.
 *
 * Every error wirebay raises for the user carries a `hint` that says how to fix the problem.
 * @module
 */

/** Process exit codes used by every command. */
export const ExitCode = {
  /** Success. */
  Ok: 0,
  /** Something went wrong. */
  Error: 1,
  /** The command line could not be understood. */
  Usage: 2,
  /** `wirebay doctor` found problems. */
  DoctorProblems: 3,
  /** A conflict or hand-edited entry needs `--force`. */
  Conflict: 4,
} as const;

/** One of the {@link ExitCode} values. */
export type ExitCodeValue = (typeof ExitCode)[keyof typeof ExitCode];

/** Options accepted by {@link core/errors!WirebayError}. */
export interface WirebayErrorOptions {
  /** What the user should do next. Shown after the message. */
  hint?: string;
  /** Exit code to use when this error ends the process. */
  exitCode?: ExitCodeValue;
}

/**
 * An expected, explainable failure (bad input, missing secret, unreadable file…).
 * Unexpected failures should be plain `Error`s so they are reported as bugs.
 */
export class WirebayError extends Error {
  /** Exit code the CLI should end with. */
  readonly exitCode: ExitCodeValue;
  /** How to fix the problem. */
  readonly hint?: string;

  /**
   * @param message - What went wrong, in one sentence.
   * @param options - Optional hint and exit code.
   */
  constructor(message: string, options: WirebayErrorOptions = {}) {
    super(message);
    this.name = "WirebayError";
    this.hint = options.hint;
    this.exitCode = options.exitCode ?? ExitCode.Error;
  }
}

/** The command line could not be understood (unknown verb, missing argument…). */
export class UsageError extends WirebayError {
  /**
   * @param message - What was wrong with the command line.
   * @param hint - An example of the correct usage, or a "did you mean" suggestion.
   */
  constructor(message: string, hint?: string) {
    super(message, { hint, exitCode: ExitCode.Usage });
    this.name = "UsageError";
  }
}

/** A config file could not be parsed. */
export class ConfigParseError extends WirebayError {
  /**
   * @param file - The file that could not be parsed.
   * @param detail - The parser's description of the problem.
   */
  constructor(file: string, detail: string) {
    super(`Could not parse ${file}: ${detail}`, { hint: "Fix the file by hand, or restore a backup with `wirebay restore <tool>`." });
    this.name = "ConfigParseError";
  }
}
