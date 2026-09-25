// The launch planner decides which secrets a server receives. Undeclared keys must never leak.

import assert from "node:assert/strict";
import { test } from "node:test";
import { WirebayError } from "../../src/core/errors.ts";
import { LaunchPlanner } from "../../src/core/launch/LaunchPlanner.ts";
import { ExecutableResolver } from "../../src/core/platform/ExecutableResolver.ts";
import { WirebayPaths } from "../../src/core/platform/WirebayPaths.ts";
import { ServerDefinition } from "../../src/core/servers/ServerDefinition.ts";

const secrets = { MY_TOKEN: "tok_secret_value_123", OTHER_TOKEN: "other_secret_value", REGION: "eu-west-1" };
const base = { PATH: process.env.PATH, Path: process.env.Path, SystemRoot: process.env.SystemRoot, PATHEXT: process.env.PATHEXT };
const planner = new LaunchPlanner(new ExecutableResolver(new WirebayPaths(), {}, base));

const stdio = new ServerDefinition({
  name: "s",
  launch: { type: "stdio", command: "node", args: ["server.js", { optional: ["--region", "${REGION}"] }] },
  secrets: [{ key: "MY_TOKEN", required: true }, { key: "REGION" }],
  env: { LOG_LEVEL: "error", PROFILE: "${REGION}-profile" },
});

test("only declared secrets reach the server", () => {
  const plan = planner.plan(stdio, secrets, base);
  assert.equal(plan.env.MY_TOKEN, "tok_secret_value_123");
  assert.equal(plan.env.REGION, "eu-west-1");
  assert.equal(plan.env.OTHER_TOKEN, undefined, "undeclared key leaked");
  assert.equal(plan.env.LOG_LEVEL, "error");
  assert.equal(plan.env.PROFILE, "eu-west-1-profile");
  assert.deepEqual(plan.args.slice(-3), ["server.js", "--region", "eu-west-1"]);
  assert.ok(plan.redact.includes("tok_secret_value_123"));
});

test("declared keys in the secrets store override env defaults", () => {
  assert.equal(planner.plan(stdio, { ...secrets, LOG_LEVEL: "debug" }, base).env.LOG_LEVEL, "error", "undeclared LOG_LEVEL is ignored");
  const declared = new ServerDefinition({ ...stdio.data, secrets: [...stdio.secrets, { key: "LOG_LEVEL" }] });
  assert.equal(planner.plan(declared, { ...secrets, LOG_LEVEL: "debug" }, base).env.LOG_LEVEL, "debug");
});

test("a missing required secret gives a fix-it hint", () => {
  assert.throws(
    () => planner.plan(stdio, {}, base),
    (e: unknown) => e instanceof WirebayError && /MY_TOKEN/.test(e.message) && /wirebay secrets set MY_TOKEN/.test(e.hint ?? ""),
  );
});

test("remote servers get the token through env, never argv", () => {
  const remote = new ServerDefinition({
    name: "r",
    launch: { type: "remote", url: "https://example.com/mcp", auth: { type: "bearer", secret: "MY_TOKEN" }, headers: { "X-Sets": "${REGION}" } },
    secrets: [{ key: "MY_TOKEN", required: true }, { key: "REGION" }],
  });
  const plan = planner.plan(remote, secrets, base);
  assert.ok(!plan.args.join(" ").includes("tok_secret_value_123"), "token must not be in argv");
  assert.equal(plan.env[LaunchPlanner.authEnv], "Bearer tok_secret_value_123");
  assert.ok(plan.args.includes(`Authorization:\${${LaunchPlanner.authEnv}}`));
  assert.ok(plan.args.includes("X-Sets:eu-west-1"));
});

test("server definitions report auth and required keys", () => {
  assert.equal(stdio.authLabel(), "token");
  assert.deepEqual(stdio.requiredKeys(), ["MY_TOKEN"]);
  const oauth = new ServerDefinition({ name: "o", launch: { type: "remote", url: "https://x", auth: { type: "oauth" } } });
  assert.equal(oauth.authLabel(), "browser login");
  assert.throws(() => stdio.withVariant("nope").launch, WirebayError);
});
