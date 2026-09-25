// YAML edits through the `yaml` Document API, which keeps comments and ordering.

import { parseDocument } from "yaml";
import { WirebayError } from "../core/errors.ts";
import type { Entry } from "../core/types.ts";
import { keyPath } from "./json.ts";

function doc(text: string, file: string) {
  const d = parseDocument(text || "{}");
  if (d.errors.length) {
    throw new WirebayError(`Could not parse ${file} as YAML: ${d.errors[0]!.message}`, {
      hint: "Fix the file by hand, or restore a backup with `wirebay restore`.",
    });
  }
  return d;
}

export function readYamlEntries(text: string, rootKey: string, file = "config file"): Record<string, Entry> {
  const value = doc(text, file).getIn(keyPath(rootKey)) as { toJSON?: () => unknown } | undefined;
  const json = value?.toJSON ? value.toJSON() : value;
  return json && typeof json === "object" ? (json as Record<string, Entry>) : {};
}

export function editYaml(text: string, rootKey: string, set: Record<string, Entry>, remove: string[], file = "config file"): string {
  const d = doc(text, file);
  const base = keyPath(rootKey);
  for (const name of remove) d.deleteIn([...base, name]);
  for (const [name, entry] of Object.entries(set)) d.setIn([...base, name], d.createNode(entry));
  return d.toString();
}
