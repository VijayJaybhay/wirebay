// A tiny MCP client used by `doctor`: starts a server, sends `initialize` and `tools/list`
// over stdio (newline-delimited JSON-RPC), and reports what came back.

import { spawn } from "node:child_process";
import { redactText, type LaunchPlan } from "../core/launcher.ts";

export interface HandshakeResult {
  ok: boolean;
  serverInfo?: { name?: string; version?: string };
  protocolVersion?: string;
  toolCount?: number;
  /** Lines on stdout that were not JSON-RPC (these break MCP clients). */
  stdoutNoise: string[];
  error?: string;
  stderrTail?: string;
  ms: number;
}

const PROTOCOL_VERSION = "2025-06-18";

export function handshake(plan: LaunchPlan, timeoutMs = 90_000): Promise<HandshakeResult> {
  const started = Date.now();
  return new Promise((resolve) => {
    const child = spawn(plan.command, plan.args, {
      env: plan.env,
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true,
      windowsVerbatimArguments: plan.verbatim ?? false,
    });
    let stdoutBuf = "";
    let stderrBuf = "";
    const noise: string[] = [];
    let result: Partial<HandshakeResult> = {};
    let done = false;

    const finish = (extra: Partial<HandshakeResult>) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      child.stdin.end();
      child.kill();
      const tail = redactText(stderrBuf.split(/\r?\n/).filter(Boolean).slice(-8).join("\n"), plan.redact);
      resolve({ ok: false, stdoutNoise: noise, ms: Date.now() - started, stderrTail: tail || undefined, ...result, ...extra });
    };

    const timer = setTimeout(() => finish({ error: `No response within ${Math.round(timeoutMs / 1000)}s` }), timeoutMs);

    const send = (msg: unknown) => child.stdin.write(JSON.stringify(msg) + "\n");

    child.on("error", (err) => finish({ error: redactText(err.message, plan.redact) }));
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
          noise.push(redactText(line.slice(0, 200), plan.redact));
          continue;
        }
        if (msg.id === 1) {
          if (msg.error) return finish({ error: `initialize failed: ${msg.error.message}` });
          const r = msg.result ?? {};
          result = {
            serverInfo: r.serverInfo as HandshakeResult["serverInfo"],
            protocolVersion: r.protocolVersion as string,
          };
          send({ jsonrpc: "2.0", method: "notifications/initialized" });
          send({ jsonrpc: "2.0", id: 2, method: "tools/list", params: {} });
        } else if (msg.id === 2) {
          if (msg.error) return finish({ ok: true, error: `tools/list failed: ${msg.error.message}` });
          const tools = (msg.result?.tools as unknown[]) ?? [];
          return finish({ ok: true, toolCount: tools.length });
        }
      }
    });

    send({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: { protocolVersion: PROTOCOL_VERSION, capabilities: {}, clientInfo: { name: "wirebay-doctor", version: "1" } },
    });
  });
}
