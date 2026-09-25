/**
 * YAML config files (e.g. Goose `config.yaml`).
 * @module
 */

import { Document, parseDocument } from "yaml";
import { ConfigParseError } from "../errors.ts";
import { splitRootKey, type Changes, type ConfigFormat, type ReadResult } from "./ConfigFormat.ts";

/** Edits YAML through the `yaml` Document API, which keeps comments and key order. */
export class YamlConfigFormat implements ConfigFormat {
  read(text: string, rootKey: string, file: string): ReadResult {
    const node = YamlConfigFormat.document(text, file).getIn(splitRootKey(rootKey)) as { toJSON?: () => unknown } | undefined;
    const json = node?.toJSON ? node.toJSON() : node;
    return { entries: json && typeof json === "object" ? (json as ReadResult["entries"]) : {}, locked: new Set() };
  }

  write(text: string, rootKey: string, changes: Changes, file: string): string {
    const doc = YamlConfigFormat.document(text, file);
    const base = splitRootKey(rootKey);
    for (const name of changes.remove) doc.deleteIn([...base, name]);
    for (const [name, entry] of Object.entries(changes.set)) doc.setIn([...base, name], doc.createNode(entry));
    return doc.toString();
  }

  private static document(text: string, file: string): Document {
    // An empty file starts as a block-style document (parsing "{}" would give flow style).
    const doc = text.trim() ? parseDocument(text) : new Document({});
    const [firstError] = doc.errors;
    if (firstError) throw new ConfigParseError(file, `invalid YAML (${firstError.message})`);
    return doc;
  }
}
