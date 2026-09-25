/**
 * The composition root: creates every service once, lazily, and wires dependencies.
 * @module
 */

import { Terminal } from "../cli/Terminal.ts";
import { AdapterFactory } from "../core/adapters/AdapterFactory.ts";
import { BackupManager } from "../core/io/BackupManager.ts";
import { SafeFileWriter } from "../core/io/SafeFileWriter.ts";
import { LaunchLogger } from "../core/launch/LaunchLogger.ts";
import { LaunchPlanner } from "../core/launch/LaunchPlanner.ts";
import { ServerLauncher } from "../core/launch/ServerLauncher.ts";
import { ExecutableResolver } from "../core/platform/ExecutableResolver.ts";
import { WirebayPaths } from "../core/platform/WirebayPaths.ts";
import { EnvFileSecretsStore } from "../core/secrets/EnvFileSecretsStore.ts";
import type { SecretsBackend } from "../core/secrets/SecretsBackend.ts";
import { ServerRegistry } from "../core/servers/ServerRegistry.ts";
import { ConfigStore } from "../core/store/ConfigStore.ts";
import { StateStore } from "../core/store/StateStore.ts";
import { Reconciler } from "../core/sync/Reconciler.ts";
import { SyncEngine } from "../core/sync/SyncEngine.ts";
import { ToolRegistry } from "../core/tools/ToolRegistry.ts";

/** Options for {@link AppContext}. */
export interface AppContextOptions {
  /** Environment to read (defaults to `process.env`). Tests pass a sandboxed one. */
  env?: NodeJS.ProcessEnv;
  /** Working directory for project scope (defaults to `process.cwd()`). */
  cwd?: string;
  /** Terminal to print to (defaults to the real one). */
  terminal?: Terminal;
}

/**
 * Holds every service a command needs. Services are created on first use and shared, so a
 * command only pays for what it touches. Construct one per CLI invocation (or per test).
 *
 * @example
 * const ctx = new AppContext({ env: { ...process.env, WIREBAY_HOME: tmp } });
 * ctx.servers.get("github").requiredKeys();
 */
export class AppContext {
  readonly env: NodeJS.ProcessEnv;
  readonly cwd: string;
  readonly paths: WirebayPaths;
  readonly terminal: Terminal;
  readonly writer = new SafeFileWriter();

  private readonly instances = new Map<string, unknown>();

  constructor(options: AppContextOptions = {}) {
    this.env = options.env ?? process.env;
    this.cwd = options.cwd ?? process.cwd();
    this.paths = new WirebayPaths(this.env);
    this.terminal = options.terminal ?? new Terminal();
  }

  /** Desired state (`config.json`). */
  get config(): ConfigStore {
    return this.lazy("config", () => new ConfigStore(this.paths, this.writer));
  }

  /** Applied state (`state.json`). */
  get state(): StateStore {
    return this.lazy("state", () => new StateStore(this.paths, this.writer));
  }

  /** The secrets store. */
  get secrets(): SecretsBackend {
    return this.lazy("secrets", () => new EnvFileSecretsStore(this.paths, this.writer));
  }

  /** Presets and user server definitions. */
  get servers(): ServerRegistry {
    return this.lazy("servers", () => new ServerRegistry(this.paths, this.writer));
  }

  /** The tools directory. */
  get tools(): ToolRegistry {
    return this.lazy("tools", () => new ToolRegistry(this.paths, this.writer));
  }

  /** Backups of tool config files. */
  get backups(): BackupManager {
    return this.lazy("backups", () => new BackupManager(this.paths, this.writer));
  }

  /** Executable lookup, using the paths remembered in `config.json`. */
  get resolver(): ExecutableResolver {
    return this.lazy("resolver", () => new ExecutableResolver(this.paths, this.config.load().paths, this.env));
  }

  /** Creates tool adapters. */
  get adapters(): AdapterFactory {
    return this.lazy("adapters", () => new AdapterFactory({ writer: this.writer, backups: this.backups }, this.resolver, this.paths));
  }

  /** Plans and applies per-file changes. */
  get reconciler(): Reconciler {
    return this.lazy("reconciler", () => new Reconciler(this.adapters));
  }

  /** Runs syncs across tools. */
  get sync(): SyncEngine {
    return this.lazy("sync", () => new SyncEngine(this));
  }

  /** Builds launch plans for servers. */
  get planner(): LaunchPlanner {
    return this.lazy("planner", () => new LaunchPlanner(this.resolver));
  }

  /** Starts servers (`wirebay run`). */
  get launcher(): ServerLauncher {
    return this.lazy("launcher", () => new ServerLauncher(new LaunchLogger(this.paths)));
  }

  private lazy<T>(key: string, create: () => T): T {
    if (!this.instances.has(key)) this.instances.set(key, create());
    return this.instances.get(key) as T;
  }
}
