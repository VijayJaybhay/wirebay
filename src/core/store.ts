// Loads and saves ~/.wirebay/config.json (desired state) and ~/.wirebay/state.json (applied state).

import { createHash } from "node:crypto";
import { readJsonIfExists, writeJson } from "./io.ts";
import { homePaths } from "./paths.ts";
import type { ScopeName, WirebayConfig, WirebayState } from "./types.ts";

export const CONFIG_VERSION = 1;
export const STATE_VERSION = 1;

export function defaultConfig(): WirebayConfig {
  return {
    $schema: "https://raw.githubusercontent.com/VijayJaybhay/wirebay/main/schemas/config.schema.json",
    version: CONFIG_VERSION,
    defaultTools: [],
    defaultScope: "user",
    renderMode: "auto",
    paths: {},
    servers: {},
  };
}

export function loadConfig(): WirebayConfig {
  const found = readJsonIfExists<Partial<WirebayConfig>>(homePaths.config());
  return { ...defaultConfig(), ...found, servers: { ...(found?.servers ?? {}) }, paths: { ...(found?.paths ?? {}) } };
}

export function saveConfig(config: WirebayConfig): void {
  writeJson(homePaths.config(), config);
}

export function loadState(): WirebayState {
  return readJsonIfExists<WirebayState>(homePaths.state()) ?? { version: STATE_VERSION, files: {} };
}

export function saveState(state: WirebayState): void {
  writeJson(homePaths.state(), state);
}

export function stateKey(tool: string, scope: ScopeName, file: string): string {
  return `${tool}|${scope}|${file}`;
}

/** Stable JSON (sorted keys) so hashes don't depend on key order. */
export function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    return `{${Object.keys(obj)
      .filter((k) => obj[k] !== undefined)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

export function hashEntry(entry: unknown): string {
  return createHash("sha256").update(stableStringify(entry)).digest("hex").slice(0, 16);
}

export function sameEntry(a: unknown, b: unknown): boolean {
  return stableStringify(a) === stableStringify(b);
}
