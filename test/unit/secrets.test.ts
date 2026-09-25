import assert from "node:assert/strict";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { SecretMasker } from "../../src/core/secrets/SecretsBackend.ts";
import { withSandbox } from "../helpers.ts";

function prepare(dir: string, content: string): void {
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, "secrets.env"), content);
}

await test("set, get, unset keep comments and other keys", () =>
  withSandbox((sb) => {
    prepare(sb.wirebayHome, "# comment\nA=1\n\n# ── b ──\nB=\n");
    const s = sb.context().secrets;
    s.set("B", "two words # not comment");
    assert.equal(s.get("B"), "two words # not comment");
    assert.equal(s.get("A"), "1");
    s.set("C", "new", "section-c");
    const text = readFileSync(s.location, "utf8");
    assert.match(text, /# ── section-c ──\nC=new/);
    assert.ok(text.startsWith("# comment\n"));
    s.unset("A");
    assert.equal(s.get("A"), undefined);
    assert.ok(s.keys().includes("A"), "unset keeps the placeholder line");
  }));

await test("empty values count as unset and ~ is expanded", () =>
  withSandbox((sb) => {
    prepare(sb.wirebayHome, "EMPTY=\nCREDS=~/.wirebay/credentials/sa.json\n");
    const s = sb.context().secrets;
    assert.equal(s.all().EMPTY, undefined);
    assert.equal(s.get("CREDS"), path.join(sb.home, ".wirebay/credentials/sa.json"));
  }));

await test("addPlaceholders appends only missing keys under a header", () =>
  withSandbox((sb) => {
    prepare(sb.wirebayHome, "EXISTING=x\n");
    const s = sb.context().secrets;
    assert.deepEqual(s.addPlaceholders("svc", [{ key: "EXISTING" }, { key: "NEW_KEY", comment: "what it is" }]), ["NEW_KEY"]);
    assert.match(readFileSync(s.location, "utf8"), /# ── svc ──\n# what it is\nNEW_KEY=\n/);
    assert.deepEqual(s.addPlaceholders("svc", [{ key: "NEW_KEY" }]), []);
  }));

await test("ensureExists creates the file from the template", () =>
  withSandbox((sb) => {
    const s = sb.context().secrets;
    assert.equal(s.ensureExists(), true);
    assert.equal(s.ensureExists(), false);
    assert.ok(s.keys().includes("GITHUB_PERSONAL_ACCESS_TOKEN"));
  }));

await test("mask never reveals short secrets and shows only the ends of long ones", () => {
  const masker = new SecretMasker();
  assert.equal(masker.mask(undefined), "(empty)");
  assert.equal(masker.mask("abc"), "•••");
  assert.equal(masker.mask("us-east-1a"), "us••••••");
  assert.equal(masker.mask("ghp_1234567890abcdefXYZ"), "ghp_…fXYZ");
  assert.equal(masker.redact("token=abc12345 end", ["abc12345"]), "token=‹redacted› end");
});
