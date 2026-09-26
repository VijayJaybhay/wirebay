/**
 * `<project>/.wirebay.json`: the servers a project uses, applied to the tools' project-level
 * config files (`.mcp.json`, `.cursor/mcp.json`, `.vscode/mcp.json`, …).
 * @module
 */

import { existsSync, realpathSync, statSync } from "node:fs";
import path from "node:path";
import { UsageError, WirebayError } from "../errors.ts";
import type { SafeFileWriter } from "../io/SafeFileWriter.ts";
import { SchemaValidator } from "../schema/SchemaValidator.ts";
import type { ProjectConfig } from "../types.ts";

/**
 * Finds, loads and saves a project's `.wirebay.json`.
 *
 * The project root is, in order: a folder chosen with `--dir`, the nearest folder (from the
 * current directory upwards) that has a `.wirebay.json`, the nearest git repository root, or the
 * current directory.
 */
export class ProjectConfigStore {
  /** File name of the project config. */
  static readonly fileName = ".wirebay.json";
  /** Current project config format version. */
  static readonly version = 1;

  private readonly writer: SafeFileWriter;
  private readonly cwd: string;
  private readonly userHome: string;
  private readonly validator = new SchemaValidator();
  private chosenRoot?: string;

  /**
   * @param writer - Used for atomic writes.
   * @param cwd - Where to start looking for the project.
   * @param userHome - The user's home folder, which is never a usable project root.
   */
  constructor(writer: SafeFileWriter, cwd: string, userHome: string) {
    this.writer = writer;
    this.cwd = cwd;
    this.userHome = userHome;
  }

  /**
   * Refuse to use the home folder as a project. Tools' project files there are the same paths as
   * their global files (and Claude Code's project `.mcp.json` would be Visual Studio's global file),
   * so project entries would silently land in global configs. Call it only for project scope.
   * @throws {@link core/errors!UsageError} when the project root is the home folder.
   */
  assertUsableRoot(): void {
    if (ProjectConfigStore.samePath(this.root, this.userHome)) {
      throw new UsageError(
        "Your home folder isn't a project: project config files there are your global config files.",
        "cd into a project folder, or pass --dir path/to/project. For global servers use --global.",
      );
    }
  }

  /** True when two paths name the same folder (real paths; case-insensitive on Windows and macOS). */
  static samePath(a: string, b: string): boolean {
    const real = (p: string): string => {
      try {
        return realpathSync.native(p);
      } catch {
        return path.resolve(p);
      }
    };
    const norm = (p: string): string => (process.platform === "linux" ? real(p) : real(p).toLowerCase());
    return norm(a) === norm(b);
  }

  /**
   * Use a specific project folder (from `--dir`).
   * @throws {@link core/errors!UsageError} when the folder does not exist.
   */
  choose(dir: string): void {
    const abs = path.resolve(this.cwd, dir);
    if (!existsSync(abs) || !statSync(abs).isDirectory())
      throw new UsageError(`Project folder "${dir}" does not exist.`, "Pass an existing folder: --dir path/to/project");
    this.chosenRoot = abs;
  }

  /** The project root (see the class description for how it is found). */
  get root(): string {
    return this.chosenRoot ?? this.findUp(ProjectConfigStore.fileName) ?? this.findUp(".git") ?? this.cwd;
  }

  /** Path of the project config file. */
  get file(): string {
    return path.join(this.root, ProjectConfigStore.fileName);
  }

  /** True when the project already has a `.wirebay.json`. */
  exists(): boolean {
    return existsSync(this.file);
  }

  /**
   * Read the project config (empty when there is none).
   * @throws {@link core/errors!WirebayError} when the file does not match `schemas/project.schema.json`.
   */
  load(): ProjectConfig {
    const found = this.writer.readJson(this.file);
    if (found === undefined) return ProjectConfigStore.defaults();
    const problems = this.validator.validate("project", found);
    if (problems.length) {
      throw new WirebayError(`${this.file} is not a valid wirebay project config: ${problems.join("; ")}`, {
        hint: "Fix it by hand (see schemas/project.schema.json), or delete it and run `wirebay init --project`.",
      });
    }
    const config = found as ProjectConfig;
    return { ...ProjectConfigStore.defaults(), ...config, servers: { ...config.servers } };
  }

  /**
   * Create an empty `.wirebay.json` in the project root unless one exists.
   * @returns True when the file was created.
   */
  create(): boolean {
    if (this.exists()) return false;
    this.save(ProjectConfigStore.defaults());
    return true;
  }

  /** Write the project config atomically. */
  save(config: ProjectConfig): void {
    this.writer.writeJson(this.file, config);
  }

  /** An empty project config. */
  static defaults(): ProjectConfig {
    return {
      $schema: "https://raw.githubusercontent.com/pragnalabs-ai/wirebay/main/schemas/project.schema.json",
      version: ProjectConfigStore.version,
      servers: {},
    };
  }

  /** The nearest folder at or above the working directory (or chosen root) that contains `name`. */
  private findUp(name: string): string | undefined {
    let dir = this.chosenRoot ?? this.cwd;
    for (;;) {
      if (existsSync(path.join(dir, name))) return dir;
      const parent = path.dirname(dir);
      if (parent === dir) return undefined;
      dir = parent;
    }
  }
}
