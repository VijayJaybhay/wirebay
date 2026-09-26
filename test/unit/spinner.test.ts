// Spinner: the progress line for slow steps. It must stay silent outside interactive terminals.

import assert from "node:assert/strict";
import { test } from "node:test";
import { Spinner } from "../../src/cli/Spinner.ts";

/** A stream that records what was written. */
function recorder(): { stream: NodeJS.WriteStream; writes: string[] } {
  const writes: string[] = [];
  const stream = { write: (chunk: string) => writes.push(chunk) > 0 } as unknown as NodeJS.WriteStream;
  return { stream, writes };
}

await test("a disabled spinner writes nothing (CI, redirected output, --json)", () => {
  const { stream, writes } = recorder();
  const spinner = new Spinner(stream, false).start("Starting github…");
  spinner.update("Still starting…");
  spinner.redraw();
  spinner.stop();
  assert.deepEqual(writes, []);
  assert.equal(spinner.active, false);
});

await test("an enabled spinner draws one line, updates it in place, and erases it on stop", () => {
  const { stream, writes } = recorder();
  const spinner = new Spinner(stream, true).start("Starting github…");
  assert.equal(spinner.active, true);
  spinner.update("Updating Cursor…");
  spinner.stop();
  assert.equal(spinner.active, false);
  assert.ok(writes[0]?.includes("Starting github…"));
  assert.ok(writes.some((w) => w.includes("Updating Cursor…")));
  assert.ok(
    writes.every((w) => w.startsWith("\r\x1b[2K")),
    "every write replaces the same line",
  );
  assert.equal(writes.at(-1), "\r\x1b[2K", "stop leaves an empty line");
});

await test("clear before ordinary output, redraw after", () => {
  const { stream, writes } = recorder();
  const spinner = new Spinner(stream, true).start("Working…");
  spinner.clear();
  assert.equal(writes.at(-1), "\r\x1b[2K");
  spinner.redraw();
  assert.ok(writes.at(-1)?.includes("Working…"));
  spinner.stop();
});
