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

/** The subset of a JSON-RPC response the handshake reads. */
interface RpcResponse {
  id?: number;
  result?: { serverInfo?: HandshakeResult["serverInfo"]; protocolVersion?: string; tools?: unknown[] };
  error?: { message?: string };
}

/** Runs one MCP handshake against a planned server. */
export class McpHandshakeClient {
  /** Protocol version sent in `initialize`. */
  static readonly protocolVersion = "2025-06-18";

  private readonly timeoutMs: number;
  private readonly masker = new SecretMasker();

  /** @param timeoutMs - Give up after this long (first runs may download packages). */
  constructor(timeoutMs = 90_000) {
    this.timeoutMs = timeoutMs;
  }

  /** Start the server, perform `initialize` + `tools/list`, then stop it. */
  run(plan: LaunchPlan): Promise<HandshakeResult> {
    const started = Date.now();
    return new Promise((resolve) => {
      const child = spawn(plan.command, plan.args, {
        env: plan.env,
        stdio: ["pipe", "pipe", "pipe"],
        windowsHide: true,
        windowsVerbatimArguments: plan.verbatim,
      });
      let stdoutBuf = "";
      let stderrBuf = "";
      const noise: string[] = [];
      let partial: Partial<HandshakeResult> = {};
      let done = false;

      const finish = (extra: Partial<HandshakeResult>): void => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        child.stdin.end();
        child.kill();
        const tail = this.masker.redact(stderrBuf.split(/\r?\n/).filter(Boolean).slice(-8).join("\n"), plan.redact);
        resolve({ ok: false, stdoutNoise: noise, ms: Date.now() - started, stderrTail: tail || undefined, ...partial, ...extra });
      };
      const timer = setTimeout(() => {
        finish({ error: `No response within ${String(Math.round(this.timeoutMs / 1000))}s` });
      }, this.timeoutMs);
      const send = (msg: unknown): void => {
        child.stdin.write(JSON.stringify(msg) + "\n");
      };

      child.on("error", (err) => {
        finish({ error: this.masker.redact(err.message, plan.redact) });
      });
      child.on("exit", (code) => {
        finish({ error: `Server exited with code ${String(code)} before finishing the handshake` });
      });
      child.stderr.on("data", (d: Buffer) => {
        stderrBuf = (stderrBuf + d.toString()).slice(-20_000);
      });
      child.stdout.on("data", (d: Buffer) => {
        stdoutBuf += d.toString();
        let nl = stdoutBuf.indexOf("\n");
        while (nl >= 0) {
          const line = stdoutBuf.slice(0, nl).trim();
          stdoutBuf = stdoutBuf.slice(nl + 1);
          nl = stdoutBuf.indexOf("\n");
          if (!line) continue;
          const msg = McpHandshakeClient.parse(line);
          if (!msg) {
            noise.push(this.masker.redact(line.slice(0, 200), plan.redact));
          } else if (msg.id === 1) {
            if (msg.error) {
              finish({ error: `initialize failed: ${msg.error.message ?? "unknown error"}` });
              return;
            }
            partial = { serverInfo: msg.result?.serverInfo, protocolVersion: msg.result?.protocolVersion };
            send({ jsonrpc: "2.0", method: "notifications/initialized" });
            send({ jsonrpc: "2.0", id: 2, method: "tools/list", params: {} });
          } else if (msg.id === 2) {
            if (msg.error) finish({ ok: true, error: `tools/list failed: ${msg.error.message ?? "unknown error"}` });
            else finish({ ok: true, toolCount: msg.result?.tools?.length ?? 0 });
            return;
          }
        }
      });

      send({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: McpHandshakeClient.protocolVersion,
          capabilities: {},
          clientInfo: { name: "wirebay-doctor", version: "1" },
        },
      });
    });
  }

  /** Parse one line of JSON-RPC, or `undefined` when it isn't JSON. */
  private static parse(line: string): RpcResponse | undefined {
    try {
      return JSON.parse(line) as RpcResponse;
    } catch {
      return undefined;
    }
  }
}
