// ${VAR} and ${VAR:-default} expansion for server args, env values, URLs and headers.

import type { ArgSpec } from "./types.ts";

const VAR_RE = /\$\{([A-Za-z_][A-Za-z0-9_]*)(?::-([^}]*))?\}/g;

export type Vars = Record<string, string | undefined>;

/** Replace ${VAR} and ${VAR:-default}. Unknown or empty variables become "" (or the default). */
export function expand(text: string, vars: Vars): string {
  return text.replace(VAR_RE, (_m, name: string, fallback?: string) => {
    const v = vars[name];
    return v !== undefined && v !== "" ? v : (fallback ?? "");
  });
}

/** Names of all variables referenced in a string. */
export function varsIn(text: string): string[] {
  return [...text.matchAll(VAR_RE)].map((m) => m[1]!);
}

/** True when every variable referenced (without a default) has a non-empty value. */
function allVarsSet(text: string, vars: Vars): boolean {
  for (const m of text.matchAll(VAR_RE)) {
    const hasDefault = m[2] !== undefined;
    const v = vars[m[1]!];
    if (!hasDefault && (v === undefined || v === "")) return false;
  }
  return true;
}

/** Expand an argument list. `{ optional: [...] }` groups are dropped when any of their variables is empty. */
export function expandArgs(args: ArgSpec[] | undefined, vars: Vars): string[] {
  const out: string[] = [];
  for (const arg of args ?? []) {
    if (typeof arg === "string") {
      out.push(expand(arg, vars));
    } else if (arg.optional.every((a) => allVarsSet(a, vars))) {
      out.push(...arg.optional.map((a) => expand(a, vars)));
    }
  }
  return out;
}

/** Every variable referenced anywhere in an argument list. */
export function varsInArgs(args: ArgSpec[] | undefined): string[] {
  return (args ?? []).flatMap((a) => (typeof a === "string" ? varsIn(a) : a.optional.flatMap(varsIn)));
}
