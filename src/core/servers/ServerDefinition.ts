/**
 * One MCP server definition (a preset, a custom server, or a preset with user overrides),
 * with the rules for which secrets it needs.
 * @module
 */

import { WirebayError } from "../errors.ts";
import { TemplateExpander } from "../template/TemplateExpander.ts";
import type { Launch, SecretSpec, ServerCategory, ServerDef } from "../types.ts";

/**
 * A server definition plus behaviour derived from it.
 *
 * @example
 * const def = new ServerDefinition(json);
 * def.requiredKeys();   // ["GITHUB_PERSONAL_ACCESS_TOKEN"]
 * def.authLabel();      // "token"
 */
export class ServerDefinition {
  /** The raw definition as stored in JSON. */
  readonly data: ServerDef;

  constructor(data: ServerDef) {
    this.data = data;
  }

  /** Unique name, e.g. `github`. */
  get name(): string {
    return this.data.name;
  }

  /** One-line description. */
  get description(): string {
    return this.data.description ?? "";
  }

  /** Catalog category (defaults to `utilities`). */
  get category(): ServerCategory {
    return this.data.category ?? "utilities";
  }

  /** `stable`, `beta` or `deprecated`. */
  get status(): NonNullable<ServerDef["status"]> {
    return this.data.status ?? "beta";
  }

  /** Where the definition came from. */
  get source(): ServerDef["source"] {
    return this.data.source;
  }

  /** Declared secrets and config keys. */
  get secrets(): SecretSpec[] {
    return this.data.secrets ?? [];
  }

  /** Default (non-secret) env values, which may reference `${VARS}`. */
  get env(): Record<string, string> {
    return this.data.env ?? {};
  }

  /** Names of the alternative launch variants. */
  get variantNames(): string[] {
    return Object.keys(this.data.variants ?? {});
  }

  /** Path to the server's guide inside the repo, if any. */
  get guide(): string | undefined {
    return this.data.guide;
  }

  /** Link to the official docs, if any. */
  get docs(): string | undefined {
    return this.data.docs;
  }

  /**
   * The launch spec in effect: the selected variant, or the default launch.
   * @throws {@link core/errors!WirebayError} when the selected variant doesn't exist.
   */
  get launch(): Launch {
    const variant = this.data.variant;
    if (!variant) return this.data.launch;
    const selected = this.data.variants?.[variant];
    if (!selected) {
      throw new WirebayError(`Server "${this.name}" has no variant "${variant}".`, {
        hint: `Available variants: ${this.variantNames.join(", ") || "none"}.`,
      });
    }
    return selected;
  }

  /** The spec for one declared key. */
  secretSpec(key: string): SecretSpec | undefined {
    return this.secrets.find((s) => s.key === key);
  }

  /** Every environment key this server may receive: declared secrets plus variables it references. */
  declaredKeys(): string[] {
    const keys = new Set(this.secrets.map((s) => s.key));
    for (const v of Object.values(this.env)) TemplateExpander.variablesIn(v).forEach((k) => keys.add(k));
    const launch = this.launch;
    if (launch.type === "stdio") {
      TemplateExpander.variablesInArgs(launch.args).forEach((k) => keys.add(k));
    } else {
      TemplateExpander.variablesIn(launch.url).forEach((k) => keys.add(k));
      for (const h of Object.values(launch.headers ?? {})) TemplateExpander.variablesIn(h).forEach((k) => keys.add(k));
      if (launch.auth && "secret" in launch.auth) keys.add(launch.auth.secret);
    }
    return [...keys];
  }

  /** Keys that must have a value before the server can start. */
  requiredKeys(): string[] {
    const keys = this.secrets.filter((s) => s.required).map((s) => s.key);
    const launch = this.launch;
    if (launch.type === "remote" && launch.auth && "secret" in launch.auth && !keys.includes(launch.auth.secret)) keys.push(launch.auth.secret);
    return keys;
  }

  /** Short description of how the server authenticates: `browser login`, `token`, `none`, … */
  authLabel(): string {
    const launch = this.launch;
    if (launch.type === "remote" && launch.auth?.type === "oauth") return "browser login";
    if (launch.type === "remote" && (!launch.auth || launch.auth.type === "none")) return "none";
    if (launch.type === "remote" && launch.auth && "secret" in launch.auth) return "token";
    const required = this.secrets.filter((s) => s.required);
    if (required.length) return required.length === 1 ? "token" : `${required.length} keys`;
    return this.secrets.length ? "optional" : "none";
  }

  /** A copy of this definition with a different variant selected. */
  withVariant(variant: string | undefined): ServerDefinition {
    return new ServerDefinition({ ...this.data, variant });
  }
}
