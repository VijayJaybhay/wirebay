/**
 * `wirebay run <server>`: what every tool config calls.
 *
 * IMPORTANT: stdout belongs to the MCP protocol. Nothing in this file may write to stdout;
 * diagnostics go to stderr and to the log file.
 * @module
 */

import { spawn } from "node:child_process";
import type { WirebayError } from "../errors.ts";
import { WirebayPaths } from "../platform/WirebayPaths.ts";
import { SecretMasker } from "../secrets/SecretsBackend.ts";
import type { LaunchLogger } from "./LaunchLogger.ts";
import type { LaunchPlan } from "./LaunchPlanner.ts";

/** Starts a planned server with stdio passed straight through, and mirrors its exit code. */
export class ServerLauncher {
  private readonly logger: LaunchLogger;

  constructor(logger: LaunchLogger) {
    this.logger = logger;
  }

  /**
   * Run a server until it exits.
   * @param name - Server name (for messages and logs).
   * @param makePlan - Builds the launch plan; its errors are reported on stderr.
   * @returns The server's exit code.
   */
  async run(name: string, makePlan: () => LaunchPlan): Promise<number> {
    let plan: LaunchPlan;
    try {
      plan = makePlan();
    } catch (err) {
      const e = err as WirebayError;
      process.stderr.write(`[wirebay] ${e.message}\n`);
      if (e.hint) process.stderr.write(`[wirebay] ${e.hint.replace(/\n/g, "\n[wirebay] ")}\n`);
      this.logger.log(name, `failed to start: ${e.message}`);
      return 1;
    }

    this.logger.log(name, `start: ${plan.command} ${plan.args.join(" ")}`, plan.redact);
    const child = spawn(plan.command, plan.args, { stdio: "inherit", env: plan.env, windowsHide: true, windowsVerbatimArguments: plan.verbatim });

    const signals: NodeJS.Signals[] = WirebayPaths.detectOs() === "win32" ? ["SIGINT", "SIGTERM"] : ["SIGINT", "SIGTERM", "SIGHUP"];
    for (const signal of signals) {
      process.on(signal, () => {
        if (!child.killed) child.kill(signal);
      });
    }

    return new Promise((resolve) => {
      child.on("error", (err) => {
        process.stderr.write(`[wirebay] could not start ${name}: ${SecretMasker.redact(err.message, plan.redact)}\n`);
        this.logger.log(name, `spawn error: ${err.message}`, plan.redact);
        resolve(1);
      });
      child.on("exit", (code, signal) => {
        this.logger.log(name, `exit: code=${code} signal=${signal ?? ""}`);
        resolve(code ?? (signal ? 1 : 0));
      });
    });
  }
}
