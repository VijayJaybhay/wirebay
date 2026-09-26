---
"@pragnalabs.ai/wirebay": minor
---

Friendlier setup and feedback:

- `wirebay add` explains every token a server needs: what it is and how to get it (steps or a link), says when a server signs in through the browser instead, and ends with the exact commands to set what is still missing. Placeholders in `secrets.env` carry the same how-to-get-it comment. Every required key of every preset now has this guidance, and `npm run validate` enforces it.
- `wirebay secrets edit` (or `secrets open`) opens the secrets file in your editor (Notepad on Windows, the default text editor on macOS). When you close it, wirebay lists which keys changed, which required keys are still missing, and which tools to restart. No sync is needed.
- Slow steps show a progress line in interactive terminals: starting servers in `wirebay doctor`, and updating each tool during `add`, `sync`, `enable`, `disable`, `remove` and `unsync`. Nothing extra is printed in CI, pipes or `--json` output.
