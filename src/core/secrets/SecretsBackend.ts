/**
 * The contract every secrets store implements. v1 ships {@link core/secrets/EnvFileSecretsStore!EnvFileSecretsStore};
 * OS keychain, 1Password or Bitwarden backends can implement this interface later.
 * @module
 */

/** A place secrets are read from and written to. */
export interface SecretsBackend {
  /** Human-readable location, e.g. a file path. */
  readonly location: string;
  /** Every secret with a non-empty value, as `KEY → value`. */
  all(): Record<string, string>;
  /** One secret's value, or `undefined` when unset or empty. */
  get(key: string): string | undefined;
  /**
   * Set a secret.
   * @param section - A section/group name used when the key is new (e.g. the server name).
   */
  set(key: string, value: string, section?: string): void;
  /** Clear a secret. Returns false when it wasn't present. */
  unset(key: string): boolean;
  /** Every key present, including empty ones. */
  keys(): string[];
  /**
   * Add empty placeholders for keys a server needs, skipping keys that already exist. A comment
   * may span several lines (`\n`); each becomes its own comment line above the key.
   * @returns The keys that were added.
   */
  addPlaceholders(section: string, entries: { key: string; comment?: string }[]): string[];
  /** Create the store if it does not exist yet. Returns true when it was created. */
  ensureExists(): boolean;
}

/** Masks secret values for display and redacts them from text. Never shows a whole secret. */
export class SecretMasker {
  private readonly replacement: string;

  /** @param replacement - Text that replaces redacted values. */
  constructor(replacement = "‹redacted›") {
    this.replacement = replacement;
  }

  /**
   * @example
   * new SecretMasker().mask("ghp_1234567890abcdefXYZ"); // "ghp_…fXYZ"
   * new SecretMasker().mask("short");                   // "•••••"
   */
  mask(value: string | undefined): string {
    if (value === undefined || value === "") return "(empty)";
    if (value.length <= 8) return "•".repeat(value.length);
    if (value.length < 16) return `${value.slice(0, 2)}${"•".repeat(6)}`;
    return `${value.slice(0, 4)}…${value.slice(-4)}`;
  }

  /** Replace every occurrence of the given secret values (4+ characters) in a text. */
  redact(text: string, secrets: string[]): string {
    let out = text;
    for (const secret of secrets) if (secret.length >= 4) out = out.split(secret).join(this.replacement);
    return out;
  }
}
