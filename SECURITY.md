# Security policy

wirebay handles API tokens, so security reports are very welcome.

## Reporting a vulnerability

Please **do not open a public issue**. Report privately through GitHub:
**[Report a vulnerability](https://github.com/VijayJaybhay/wirebay/security/advisories/new)**
(Security tab → Advisories → "Report a vulnerability").

Include what you found, how to reproduce it, and the impact. We aim to reply within 7 days and to
release a fix as soon as possible, crediting you if you want.

## Never share real tokens

Do not paste real tokens, `secrets.env` contents, or unredacted tool config files into issues,
discussions or pull requests. `wirebay doctor --json` output is safe to share, because it never
contains secret values. If you shared a token by accident, **revoke it at the provider first**.

## Supported versions

Only the latest release gets security fixes during 0.x.

## Scope

In scope: secret handling, the launcher (`wirebay run`), file writes to tool configs, backups and
restore, and anything that could leak a secret into logs, output or configs.

Out of scope: vulnerabilities in the MCP servers themselves (report them to their maintainers),
and the fact that `secrets.env` is plaintext on disk. That is a documented trade-off; see
[docs/security.md](docs/security.md).
