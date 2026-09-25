import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { EnvFileBackend, mask } from "../../src/core/secrets.ts";
import { sandbox } from "../helpers.ts";

test("set, get, unset keep comments and other keys", () => {
  const sb = sandbox();
  try {
    const file = path.join(sb.wirebayHome, "secrets.env");
    mkdirSync(sb.wirebayHome, { recursive: true });
    writeFileSync(file, "# comment\nA=1\n\n# ── b ──\nB=\n");
    const s = new EnvFileBackend(file);
    s.set("B", "two words # not comment");
    assert.equal(s.get("B"), "two words # not comment");
    assert.equal(s.get("A"), "1");
    s.set("C", "new", "section-c");
    assert.match(readFileSync(file, "utf8"), /# ── section-c ──\nC=new/);
    assert.ok(readFileSync(file, "utf8").startsWith("# comment\n"));
    s.unset("A");
    assert.equal(s.get("A"), undefined);
    assert.ok(s.keys().includes("A"), "unset keeps the placeholder line");
  } finally {
    sb.cleanup();
  }
});

test("empty values count as unset and ~ is expanded", () => {
  const sb = sandbox();
  try {
    const file = path.join(sb.wirebayHome, "secrets.env");
    mkdirSync(sb.wirebayHome, { recursive: true });
    writeFileSync(file, "EMPTY=\nCREDS=~/.wirebay/credentials/sa.json\n");
    const s = new EnvFileBackend(file);
    assert.equal(s.all().EMPTY, undefined);
    assert.equal(s.get("CREDS"), path.join(sb.home, ".wirebay/credentials/sa.json"));
  } finally {
    sb.cleanup();
  }
});

test("addPlaceholders appends only missing keys under a header", () => {
  const sb = sandbox();
  try {
    const file = path.join(sb.wirebayHome, "secrets.env");
    mkdirSync(sb.wirebayHome, { recursive: true });
    writeFileSync(file, "EXISTING=x\n");
    const s = new EnvFileBackend(file);
    assert.deepEqual(s.addPlaceholders("svc", [{ key: "EXISTING" }, { key: "NEW_KEY", comment: "what it is" }]), ["NEW_KEY"]);
    assert.match(readFileSync(file, "utf8"), /# ── svc ──\n# what it is\nNEW_KEY=\n/);
    assert.deepEqual(s.addPlaceholders("svc", [{ key: "NEW_KEY" }]), []);
  } finally {
    sb.cleanup();
  }
});

test("mask never reveals short secrets and shows only the ends of long ones", () => {
  assert.equal(mask(undefined), "(empty)");
  assert.equal(mask("abc"), "•••");
  assert.equal(mask("us-east-1a"), "us••••••");
  assert.equal(mask("ghp_1234567890abcdefXYZ"), "ghp_…fXYZ");
});
