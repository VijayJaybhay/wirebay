/**
 * `${VAR}` and `${VAR:-default}` expansion for server arguments, env values, URLs and headers.
 * @module
 */

import type { ArgSpec } from "../types.ts";

/** Variable values used during expansion. Missing and empty values behave the same. */
export type TemplateVars = Record<string, string | undefined>;

/**
 * Expands variables in strings and argument lists.
 *
 * @example
 * const t = new TemplateExpander();
 * t.expand("--region=${REGION:-us-east-1}", {}); // "--region=us-east-1"
 * t.expandArgs(["mcp", { optional: ["--dir", "${DIR}"] }], {}); // ["mcp"]
 */
export class TemplateExpander {
  private readonly pattern = /\$\{([A-Za-z_][A-Za-z0-9_]*)(?::-([^}]*))?\}/g;

  /**
   * Replace `${VAR}` and `${VAR:-default}` in a string.
   * Unknown or empty variables become `""` (or the default).
   */
  expand(text: string, vars: TemplateVars): string {
    return text.replace(this.pattern, (_match, name: string, fallback: string | undefined) => {
      const value = vars[name];
      return value !== undefined && value !== "" ? value : (fallback ?? "");
    });
  }

  /** Names of every variable referenced in a string. */
  variablesIn(text: string): string[] {
    return [...text.matchAll(this.pattern)].flatMap((m) => (m[1] === undefined ? [] : [m[1]]));
  }

  /** Names of every variable referenced in an argument list (including optional groups). */
  variablesInArgs(args: ArgSpec[] | undefined): string[] {
    return (args ?? []).flatMap((a) => (typeof a === "string" ? this.variablesIn(a) : a.optional.flatMap((x) => this.variablesIn(x))));
  }

  /**
   * Expand an argument list. An `{ optional: [...] }` group is dropped entirely when any variable
   * it references (without a default) is empty.
   */
  expandArgs(args: ArgSpec[] | undefined, vars: TemplateVars): string[] {
    const out: string[] = [];
    for (const arg of args ?? []) {
      if (typeof arg === "string") out.push(this.expand(arg, vars));
      else if (arg.optional.every((a) => this.allSet(a, vars))) out.push(...arg.optional.map((a) => this.expand(a, vars)));
    }
    return out;
  }

  private allSet(text: string, vars: TemplateVars): boolean {
    for (const m of text.matchAll(this.pattern)) {
      const name = m[1];
      const hasDefault = m[2] !== undefined;
      const value = name === undefined ? undefined : vars[name];
      if (!hasDefault && (value === undefined || value === "")) return false;
    }
    return true;
  }
}
