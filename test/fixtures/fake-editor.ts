// A stand-in for a text editor in tests: `EDITOR="node fake-editor.ts KEY=value"` fills in KEY
// in the file it is given (the last argument), as a person would, then exits.

import { readFileSync, writeFileSync } from "node:fs";

const args = process.argv.slice(2);
const file = args.at(-1);
if (!file) throw new Error("usage: fake-editor.ts KEY=value … <file>");
let text = readFileSync(file, "utf8");
for (const assignment of args.slice(0, -1)) {
  const key = assignment.split("=")[0] ?? "";
  const line = new RegExp(`^${key}=.*$`, "m");
  text = line.test(text) ? text.replace(line, assignment) : `${text}\n${assignment}\n`;
}
writeFileSync(file, text);
