/**
 * Small value helpers used across the code base.
 * @module
 */

/**
 * Return a value that the surrounding logic guarantees is present, or fail loudly.
 * Use instead of the `!` non-null assertion, so a broken invariant produces a clear error.
 *
 * @param value - The value that must be present.
 * @param what - Short description for the error message.
 * @throws Error when the value is `undefined` or `null` (a bug, not a user error).
 */
export function defined<T>(value: T | undefined | null, what: string): T {
  if (value === undefined || value === null) throw new Error(`Internal error: expected ${what}`);
  return value;
}

/**
 * Treat empty strings as missing: environment variables and dotenv values are often set to "".
 * @returns The value, or `undefined` when it is `undefined` or `""`.
 */
export function nonEmpty(value: string | undefined): string | undefined {
  return value === undefined || value === "" ? undefined : value;
}
