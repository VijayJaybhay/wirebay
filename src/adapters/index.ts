// Picks the adapter for a tool: the generic one, unless tool.json names a code override.

import type { ToolManifest } from "../core/types.ts";
import { genericAdapter } from "./generic.ts";
import { claudeCodeAdapter } from "./overrides/claude-code.ts";
import type { Adapter } from "./types.ts";

const overrides: Record<string, Adapter> = {
  "claude-code": claudeCodeAdapter,
};

export function adapterFor(tool: ToolManifest): Adapter {
  return (tool.adapter && overrides[tool.adapter]) || genericAdapter;
}
