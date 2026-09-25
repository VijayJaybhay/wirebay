// The launcher decides which secrets a server receives. Undeclared keys must never leak.

import assert from "node:assert/strict";
import { test } from "node:test";
import { AUTH_ENV, buildLaunchPlan, redactText } from "../../src/core/launcher.ts";
import { WirebayError } from "../../src/core/errors.ts";
import type { ServerDef } from "../../src/core/types.ts";

const secrets = { MY_TOKEN: "tok_secret_value_123", OTHER_TOKEN: "other_secret_value", REGION: "eu-west-1" };
const base = { PATH: process.env.PATH, Path: process.env.Path, SystemRoot: process.env.SystemRoot };

const stdio: ServerDef = {
  name: "s",
  launch: { type: "stdio", command: "node", args: ["server.js", { optional: ["--region", "${REGION}"] }] },
  secrets: [{ key: "MY_TOKEN", required: true }, { key: "REGION" }],
  env: { LOG_LEVEL: "error", PROFILE: "${REGION}-profile" },
};

test("only declared secrets reach the server", () => {
  const plan = buildLaunchPlan(stdio, secrets, base);
  assert.equal(plan.env.MY_TOKEN, "tok_secret_value_123");
  assert.equal(plan.env.REGION, "eu-west-1");
  assert.equal(plan.env.OTHER_TOKEN, undefined, "undeclared key leaked");
  assert.equal(plan.env.LOG_LEVEL, "error");
  assert.equal(plan.env.PROFILE, "eu-west-1-profile");
  assert.deepEqual(plan.args.slice(-3), ["server.js", "--region", "eu-west-1"]);
  assert.ok(plan.redact.includes("tok_secret_value_123"));
});

test("secrets file overrides env defaults", () => {
  const plan = buildLaunchPlan(stdio, { ...secrets, LOG_LEVEL: "debug" }, base);
  assert.equal(plan.env.LOG_LEVEL, "error", "LOG_LEVEL is not declared as a secret, so the default wins");
  const declared: ServerDef = { ...stdio, secrets: [...stdio.secrets!, { key: "LOG_LEVEL" }] };
  assert.equal(buildLaunchPlan(declared, { ...secrets, LOG_LEVEL: "debug" }, base).env.LOG_LEVEL, "debug");
});

test("missing required secret gives a fix-it hint", () => {
  assert.throws(
    () => buildLaunchPlan(stdio, {}, base),
    (e: unknown) => e instanceof WirebayError && /MY_TOKEN/.test(e.message) && /wirebay secrets set MY_TOKEN/.test(e.hint ?? ""),
  );
});

test("remote servers get the token through env, never argv", () => {
  const remote: ServerDef = {
    name: "r",
    launch: { type: "remote", url: "https://example.com/mcp", auth: { type: "bearer", secret: "MY_TOKEN" }, headers: { "X-Sets": "${REGION}" } },
    secrets: [{ key: "MY_TOKEN", required: true }, { key: "REGION" }],
  };
  const plan = buildLaunchPlan(remote, secrets, base);
  assert.ok(!plan.args.join(" ").includes("tok_secret_value_123"), "token must not be in argv");
  assert.equal(plan.env[AUTH_ENV], "Bearer tok_secret_value_123");
  assert.ok(plan.args.includes(`Authorization:\${${AUTH_ENV}}`));
  assert.ok(plan.args.includes("X-Sets:eu-west-1"));
});

test("redactText hides secret values", () => {
  assert.equal(redactText("token=abc12345 end", ["abc12345"]), "token=‹redacted› end");
});
