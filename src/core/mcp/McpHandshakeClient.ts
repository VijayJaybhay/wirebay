/**
 * A minimal MCP client used by `doctor`: starts a server, sends `initialize` and `tools/list`
 * over stdio (newline-delimited JSON-RPC), and reports what came back.
 * @module
 */

import { spawn } from "node:child_process";
import type { LaunchPlan } from "../launch/LaunchPlanner.ts";
import { SecretMasker } from "../secrets/SecretsBackend.ts";

/** Outcome of a handshake. */
export interface HandshakeResult {
  ok: boolean;
  serverInfo?: { name?: string; version?: string };
  protocolVersion?: string;
  toolCount?: number;
  /** Lines on stdout that were not JSON-RPC (these break MCP clients). */
  stdoutNoise: string[];
  error?: string;
  /** Last lines the server wrote to stderr (secrets redacted). */
  stderrTail?: string;
  /** How long it took, in milliseconds. */
  ms: number;
}

/** Runs one MCP handshake against a planned server. */
export class McpHandshakeClient {
  /** Protocol version sent in `initialize`. */
  static readonly protocolVersion = "2025-06-18";

  private readonly timeoutMs: number;

  /** @param timeoutMs - Give up after this long (first runs may download packages). */
  constructor(timeoutMs = 90_000) {
    this.timeoutMs = timeoutMs;
  }

  /** Start the server, perform `initialize` + `tools/list`, then stop it. */
  run(plan: LaunchPlan): Promise<HandshakeResult> {
    const started = Date.now();
    return new Promise((resolve) => {
      const child = spawn(plan.command, plan.args, { env: plan.env, stdio: ["pipe", "pipe", "pipe"], windowsHide: true, windowsVerbatimArguments: plan.verbatim });
      let stdoutBuf = "";
      let stderrBuf = "";
      const noise: string[] = [];
      let partial: Partial<HandshakeResult> = {};
      let done = false;

      const finish = (extra: Partial<HandshakeResult>) => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        child.stdin.end();
        child.kill();
        const tail = SecretMasker.redact(stderrBuf.split(/\r?\n/).filter(Boolean).slice(-8).join("\n"), plan.redact);
        resolve({ ok: false, stdoutNoise: noise, ms: Date.now() - started, stderrTail: tail || undefined, ...partial, ...extra });
      };
      const timer = setTimeout(() => finish({ error: `No response within ${Math.round(this.timeoutMs / 1000)}s` }), this.timeoutMs);
      const send = (msg: unknown) => child.stdin.write(JSON.stringify(msg) + "\n");

      child.on("error", (err) => finish({ error: SecretMasker.redact(err.message, plan.redact) }));
      child.on("exit", (code) => finish({ error: `Server exited with code ${code} before finishing the handshake` }));
      child.stderr.on("data", (d: Buffer) => {
        stderrBuf = (stderrBuf + d.toString()).slice(-20_000);
      });
      child.stdout.on("data", (d: Buffer) => {
        stdoutBuf += d.toString();
        let nl: number;
        while ((nl = stdoutBuf.indexOf("\n")) >= 0) {
          const line = stdoutBuf.slice(0, nl).trim();
          stdoutBuf = stdoutBuf.slice(nl + 1);
          if (!line) continue;
          let msg: { id?: number; result?: Record<string, unknown>; error?: { message?: string } };
          try {
            msg = JSON.parse(line);
          } catch {
            noise.push(SecretMasker.redact(line.slice(0, 200), plan.redact));
            continue;
          }
          if (msg.id === 1) {
            if (msg.error) return finish({ error: `initialize failed: ${msg.error.message}` });
            partial = { serverInfo: msg.result?.serverInfo as HandshakeResult["serverInfo"], protocolVersion: msg.result?.protocolVersion as string };
            send({ jsonrpc: "2.0", method: "notifications/initialized" });
            send({ jsonrpc: "2.0", id: 2, method: "tools/list", params: {} });
          } else if (msg.id === 2) {
            if (msg.error) return finish({ ok: true, error: `tools/list failed: ${msg.error.message}` });
            return finish({ ok: true, toolCount: ((msg.result?.tools as unknown[]) ?? []).length });
          }
        }
      });

      send({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: { protocolVersion: McpHandshakeClient.protocolVersion, capabilities: {}, clientInfo: { name: "wirebay-doctor", version: "1" } },
      });
    });
  }
}
