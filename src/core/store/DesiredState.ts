/**
 * The desired state for each scope: global servers live in `~/.wirebay/config.json`, project
 * servers in the project's `.wirebay.json`.
 * @module
 */

import type { ScopeName, ServerMap } from "../types.ts";
import type { ConfigStore } from "./ConfigStore.ts";
import type { ProjectConfigStore } from "./ProjectConfigStore.ts";
import { ServerMapOps } from "./ServerMapOps.ts";

/** Reads and writes "which servers go to which tools" for the user (global) or project scope. */
export class DesiredState {
  private readonly config: ConfigStore;
  private readonly project: ProjectConfigStore;

  constructor(config: ConfigStore, project: ProjectConfigStore) {
    this.config = config;
    this.project = project;
  }

  /** The servers → tools map for a scope. */
  servers(scope: ScopeName): ServerMapOps {
    return new ServerMapOps(scope === "user" ? this.config.load().servers : this.project.load().servers);
  }

  /** Replace the servers → tools map for a scope. */
  save(scope: ScopeName, servers: ServerMap): void {
    if (scope === "user") this.config.save({ ...this.config.load(), servers });
    else this.project.save({ ...this.project.load(), servers });
  }

  /** Where a scope's desired state is stored (for messages). */
  location(scope: ScopeName): string {
    return scope === "user" ? "~/.wirebay/config.json" : this.project.file;
  }

  /** Server names added in any scope that applies here (global plus this project's). */
  allServerNames(): string[] {
    const project = this.project.exists() ? this.servers("project").names() : [];
    return [...new Set([...this.servers("user").names(), ...project])].sort();
  }
}
