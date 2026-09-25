# Maintaining the tools directory and presets

Tools change their config formats and servers ship new versions. Every manifest and preset carries
`lastVerified`, and anything older than 90 days is due for re-verification.

## Find what's due

```bash
node src/cli.ts tools --stale            # tools not verified in 90 days
node src/cli.ts presets --stale
node src/cli.ts tools --stale --days 30  # stricter
```

A monthly GitHub Action (`.github/workflows/stale-directory.yml`) posts the same list as an issue.

## Re-verify a tool

1. Open `docs.mcp` from `tools/<id>/tool.json` and the tool's changelog or release notes.
2. Compare with the manifest:
   - config path per OS and scope
   - format
   - `rootKey`
   - entry fields
   - `.cmd` support
   - restart behaviour
3. If you have the tool: sync to a test home, then to your real config, and check the servers
   appear (`node src/cli.ts tools verify <id>`).
4. Update:
   - `tool.json`: bump `lastVerified`, and set `verifiedVersion` to the tool version you checked
   - `GUIDE.md`: add a line to _Changelog_ if anything changed
5. `npm run gen:docs && npm run validate && npm test`
6. Add a patch changeset, e.g. `tools: re-verify cursor (no changes)`.

Nothing changed? Still bump `lastVerified`; that's valuable information.

## Re-verify a preset

1. Check the latest package version (`npm view <pkg> version`, PyPI, image tags) and the server's
   release notes for breaking changes (env vars, args, auth).
2. Update the pinned version in `presets/<name>.json`, plus the guide if something changed.
3. Run `node src/cli.ts doctor <name>` with a real (test) credential; it must pass.
4. Bump `lastVerified`, run `gen:docs`, `validate` and `test`, and add a patch changeset.

## Status values

| Status       | Meaning                                                               |
| ------------ | --------------------------------------------------------------------- |
| `beta`       | New or verified by one person only                                    |
| `stable`     | Verified by at least two people or over several releases              |
| `deprecated` | The tool or server is discontinued; kept so users see a clear message |
