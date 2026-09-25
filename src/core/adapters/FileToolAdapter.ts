/**
 * The adapter used by almost every tool: read, edit and write the config file directly,
 * driven entirely by the tool's manifest.
 * @module
 */

import { ToolAdapter } from "./ToolAdapter.ts";

/** Generic file-based adapter. All behaviour comes from {@link ToolAdapter} and the format strategy. */
export class FileToolAdapter extends ToolAdapter {}
