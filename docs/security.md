# Security model

## What wirebay protects against

| Risk | How wirebay handles it |
|---|---|
| Tokens copied into many tool configs (which get synced, shared, committed, screenshotted) | Tool configs only contain `wirebay run <server>`. Tokens stay in one file. |
| One server reading another server's tokens | The launcher passes each server only the keys it declares. |
| Tokens visible in process lists | Remote-server tokens go through the environment, not argv. |
| Other local users reading your tokens | `secrets.env` and `credentials/` are restricted to your user; `doctor` warns if that changes. |
| Tokens leaking into logs or output | Values are masked in output and redacted in launcher logs. There's a test that fails if a sentinel secret appears anywhere else. |
| A sync breaking your tool config | Backups before every write, atomic writes, conflict and drift detection, `wirebay restore`. |
| Supply-chain surprises | Presets pin package versions instead of `@latest`; updates go through review. |

## What it does not protect against

- **Plaintext at rest.** `secrets.env` is a plain file (by design in v1, for simplicity and
  transparency). Anyone or anything running as *your user* can read it, including malware and
  the MCP servers you run. Use disk encryption, and prefer short-lived, narrowly scoped tokens.
- **What servers do with access.** An MCP server, and the AI driving it, can do anything its
  token allows. Use least-privilege tokens (each [server guide](servers/README.md) shows how) and
  read-only modes where available.
- **Environment inspection.** A process running as your user can read the environment of a server
  it can inspect. This is true of every approach that passes secrets to a local process.

## Good practice

- One token per purpose (a separate token for MCP), with an expiry.
- Read-only first (`READ_OPERATIONS_ONLY=true` for AWS, read-only GitHub permissions).
- `wirebay doctor` after changes; it checks file permissions too.
- Never paste `secrets.env` or unredacted tool configs into issues or chats.

Report vulnerabilities privately: see [SECURITY.md](../SECURITY.md).
