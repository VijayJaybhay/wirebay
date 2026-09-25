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
 * TemplateExpander.expand("--region=${REGION:-us-east-1}", {}); // "--region=us-east-1"
 * TemplateExpander.expandArgs(["mcp", { optional: ["--dir", "${DIR}"] }], {}); // ["mcp"]
 */
export class TemplateExpander {
  private static readonly pattern = /\$\{([A-Za-z_][A-Za-z0-9_]*)(?::-([^}]*))?\}/g;

  /**
   * Replace `${VAR}` and `${VAR:-default}` in a string.
   * Unknown or empty variables become `""` (or the default).
   */
  static expand(text: string, vars: TemplateVars): string {
    return text.replace(TemplateExpander.pattern, (_m, name: string, fallback?: string) => {
      const v = vars[name];
      return v !== undefined && v !== "" ? v : (fallback ?? "");
    });
  }

  /** Names of every variable referenced in a string. */
  static variablesIn(text: string): string[] {
    return [...text.matchAll(TemplateExpander.pattern)].map((m) => m[1]!);
  }

  /** Names of every variable referenced in an argument list (including optional groups). */
  static variablesInArgs(args: ArgSpec[] | undefined): string[] {
    return (args ?? []).flatMap((a) => (typeof a === "string" ? TemplateExpander.variablesIn(a) : a.optional.flatMap((x) => TemplateExpander.variablesIn(x))));
  }

  /**
   * Expand an argument list. An `{ optional: [...] }` group is dropped entirely when any variable
   * it references (without a default) is empty.
   */
  static expandArgs(args: ArgSpec[] | undefined, vars: TemplateVars): string[] {
    const out: string[] = [];
    for (const arg of args ?? []) {
      if (typeof arg === "string") out.push(TemplateExpander.expand(arg, vars));
      else if (arg.optional.every((a) => TemplateExpander.allSet(a, vars))) out.push(...arg.optional.map((a) => TemplateExpander.expand(a, vars)));
    }
    return out;
  }

  private static allSet(text: string, vars: TemplateVars): boolean {
    for (const m of text.matchAll(TemplateExpander.pattern)) {
      const hasDefault = m[2] !== undefined;
      const v = vars[m[1]!];
      if (!hasDefault && (v === undefined || v === "")) return false;
    }
    return true;
  }
}
