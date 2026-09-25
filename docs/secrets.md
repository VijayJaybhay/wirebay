# Secrets

All secrets live in **one file**: `~/.wirebay/secrets.env` (`%USERPROFILE%\.wirebay\secrets.env` on
Windows). Set `WIREBAY_HOME` to move the whole `.wirebay` folder.

## The file

Standard dotenv syntax. `wirebay init` creates it from a commented template with a section per
built-in server, and makes it readable only by you (`chmod 600`, or a Windows ACL for your user only).

```dotenv
# ── github ── …/docs/servers/github.md
GITHUB_PERSONAL_ACCESS_TOKEN=github_pat_…
GITHUB_TOOLSETS=repos,issues,pull_requests,actions

# ── netlify ──
NETLIFY_PERSONAL_ACCESS_TOKEN=nfp_…
```

- Empty values count as *not set*.
- Quote values that contain spaces or `#`: `KEY="a value # not a comment"`.
- `~` and `${OTHER_KEY}` are expanded, which is handy for file paths:
  `GOOGLE_APPLICATION_CREDENTIALS=~/.wirebay/credentials/sa.json`.
- `wirebay add` appends placeholders for a new server's keys under its own `# ── name ──` header.

## Commands

```bash
wirebay secrets set KEY           # hidden prompt
echo "$T" | wirebay secrets set KEY --stdin   # for scripts and password managers
wirebay secrets list              # masked values, which servers use each key, what's missing
wirebay secrets unset KEY         # clear a value (keeps the placeholder line)
wirebay secrets edit              # open the file in $EDITOR (notepad on Windows)
wirebay secrets path              # print the file location
```

Values are never printed in full; `list` shows at most the first and last 4 characters of long
values. `secrets set KEY=value` works, but it leaves the value in your shell history, so prefer
the prompt.

## Who gets which secret

Each server definition declares its keys (`secrets[]`, plus any `${VAR}` it references). When a
tool starts a server, `wirebay run` passes **only those keys**. A Netlify server never sees your
GitHub token.

Remote servers get their token through the environment of the `mcp-remote` bridge, never on the
command line, where other processes could see it.

## Credential files

Some providers use key *files* (for example Google service accounts). Put them in
`~/.wirebay/credentials/` (created by `init`, readable only by you) and reference the path from
`secrets.env`.

## Rotation

1. Create the new token at the provider.
2. `wirebay secrets set KEY`
3. Restart the AI tool, or toggle the server. There's no need to re-sync.
4. Revoke the old token.

## Using a password manager

v1 stores secrets in the file. You can still feed it from a password manager:

```bash
op read "op://Private/GitHub MCP/token" | wirebay secrets set GITHUB_PERSONAL_ACCESS_TOKEN --stdin
```

Direct keychain / 1Password / Bitwarden backends are on the [roadmap](roadmap.md). The code already
has a `SecretsBackend` interface for them (`src/core/secrets.ts`).
