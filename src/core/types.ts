// Shared type definitions. These mirror the JSON Schemas in /schemas.

/** Per-OS value, or a single value used on every OS. */
export type PerOs<T> = T | { win32?: T; darwin?: T; linux?: T };

/** An argument: a plain string, or a group dropped entirely when any variable inside it is empty. */
export type ArgSpec = string | { optional: string[] };

export interface SecretSpec {
  key: string;
  required?: boolean;
  description?: string;
  /** Regex a valid value is expected to match (used only to warn, never to print). */
  pattern?: string;
  /** Link to the guide section explaining how to create this secret. */
  help?: string;
}

export interface StdioLaunch {
  type: "stdio";
  command: string;
  args?: ArgSpec[];
}

export interface RemoteLaunch {
  type: "remote";
  url: string;
  /** Extra NON-secret headers (values may use ${VARS}; headers that expand to "" are dropped). */
  headers?: Record<string, string>;
  auth?:
    | { type: "none" }
    | { type: "oauth" }
    | { type: "bearer"; secret: string }
    | { type: "header"; header: string; secret: string; prefix?: string };
}

export type Launch = StdioLaunch | RemoteLaunch;

export type ServerCategory =
  | "code-hosting"
  | "dev-tools"
  | "browser"
  | "databases"
  | "cloud"
  | "observability"
  | "productivity"
  | "design"
  | "search"
  | "payments"
  | "ai"
  | "utilities";

export interface ServerDef {
  $schema?: string;
  version?: number;
  name: string;
  description?: string;
  category?: ServerCategory;
  launch: Launch;
  variants?: Record<string, Launch>;
  /** Name of the variant to use instead of `launch`. */
  variant?: string;
  secrets?: SecretSpec[];
  /** Default (non-secret) environment values. Values may reference ${VARS}. */
  env?: Record<string, string>;
  prereqs?: string[];
  docs?: string;
  /** Setup tips and risk notes shown in the server catalog. */
  notes?: string[];
  guide?: string;
  lastVerified?: string;
  status?: "stable" | "beta" | "deprecated";
  /** Where this definition came from (filled in at load time). */
  source?: "preset" | "user" | "preset+user";
}

export type ScopeName = "user" | "project";

export interface ToolConfigLocation {
  path: PerOs<string>;
  createIfMissing?: boolean;
}

/** One way a tool (the reader) also loads MCP servers from another tool's config file. */
export interface ConfigRead {
  /** Id of the tool whose config file is read, e.g. `claude-code`. */
  tool: string;
  /** Which of that tool's files: its user (global) or project file. */
  scope: ScopeName;
  /** `always`: read by default; `setting`: only with a reader setting on; `approval`: each server must be approved. */
  when: "always" | "setting" | "approval";
  /** The reader's setting name when `when` is `setting`. */
  setting?: string;
  /** False when the reader expects a different structure and reports an error for that file. */
  compatible: boolean;
  /** Short explanation shown to users. */
  note: string;
  /** Official docs URL for this fact. */
  source: string;
}

export interface ToolManifest {
  $schema?: string;
  version?: number;
  id: string;
  name: string;
  aliases?: string[];
  homepage?: string;
  docs?: { mcp?: string; changelog?: string };
  detect?: {
    commands?: string[];
    paths?: PerOs<string>[];
    /** False: the config file existing doesn't mean the tool is installed (another tool or wirebay may have written it). */
    configFile?: boolean;
  };
  configs: Partial<Record<ScopeName, ToolConfigLocation>>;
  /** Other tools' MCP config files this tool also reads (from its docs). */
  alsoReads?: ConfigRead[];
  format: "json" | "jsonc" | "toml" | "yaml";
  /** Dot-separated key under which servers live, e.g. "mcpServers" or "mcp_servers". */
  rootKey: string;
  mergeStrategy?: "edit" | "managed-block";
  entry: { stdio: Record<string, unknown>; extra?: Record<string, unknown> };
  supports?: { stdio?: boolean; http?: boolean; envExpansion?: boolean; cmdShims?: boolean };
  cli?: { list?: string };
  /** Name of a code override in src/adapters/overrides (only for tools the generic adapter can't express). */
  adapter?: string;
  restartRequired?: boolean;
  status?: "stable" | "beta" | "deprecated";
  lastVerified?: string;
  verifiedVersion?: string;
  maintainers?: string[];
  source?: "package" | "user";
}

export type RenderMode = "auto" | "absolute" | "portable";

/** Which tools each server is enabled for (the heart of the desired state). */
export type ServerMap = Record<string, { tools: string[] }>;

/**
 * `<project>/.wirebay.json`: servers this project uses, written into the tools' *project* config
 * files. Meant to be committed so a team shares it; contains no secrets.
 */
export interface ProjectConfig {
  $schema?: string;
  version: number;
  servers: ServerMap;
}

/** ~/.wirebay/config.json: the desired state. */
export interface WirebayConfig {
  $schema?: string;
  version: number;
  defaultTools: string[];
  defaultScope: ScopeName;
  renderMode: RenderMode;
  /** Absolute paths to executables captured at `init` (GUI apps often lack a shell PATH). */
  paths: Record<string, string>;
  servers: Record<string, { tools: string[] }>;
}

/** ~/.wirebay/state.json: what wirebay has actually written. */
export interface WirebayState {
  version: number;
  files: Record<string, StateFile>;
}

export interface StateFile {
  tool: string;
  scope: ScopeName;
  path: string;
  /** Hash of each managed entry as it actually appears in the file. */
  entries: Record<string, string>;
  /** Hash of the entry wirebay asked for (differs from `entries` when a tool CLI normalises it). */
  desired?: Record<string, string>;
  /** True when wirebay created this file (so it may delete it again once it is empty). */
  created?: true;
}

/** A rendered server entry as it appears inside a tool's config. */
export type Entry = Record<string, unknown>;
