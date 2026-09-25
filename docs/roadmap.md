# Roadmap

Ideas and planned work. Open an issue or discussion to propose something.

## v0.2: adoption and maintenance

- `wirebay import`: adopt servers already configured in your tools, move plaintext tokens into
  `secrets.env`, and replace the entries with managed ones (dry-run first, with backups).
- Interactive `wirebay add` wizard when no options are given.
- `wirebay presets verify` (like `tools verify`).
- More tools: Windsurf, Zed, Cline, Continue, JetBrains AI Assistant, Amazon Q Developer.
- More presets (community-driven).

## Later

- Secrets backends: OS keychain (Windows Credential Manager, macOS Keychain, libsecret),
  1Password (`op`), Bitwarden. The `SecretsBackend` interface is already in place.
- Profiles: separate secret sets (e.g. `work` / `personal`) and per-profile server lists.
- Native remote entries for tools that support HTTP transport and header env expansion (skipping
  the mcp-remote bridge where it's safe).
- A docs site (VitePress on GitHub Pages) from the same Markdown files.

## Non-goals

- A GUI.
- Hosting or proxying servers beyond starting them locally.
- Syncing secrets between machines.
- Telemetry.
