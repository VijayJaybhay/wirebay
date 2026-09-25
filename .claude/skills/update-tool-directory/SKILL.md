---
name: update-tool-directory
description: Re-verify wirebay's tools directory and server presets against official docs and latest versions (bump pinned versions, fix changed config paths/formats, update lastVerified). Use for "maintain/refresh the tools directory", "check stale tools", "update presets", or the monthly stale-directory issue.
---

# Maintain the tools directory and presets

The canonical steps are in `docs/contributing/maintaining-directory.md`. Read it first.

## Steps

1. **List what's due:**
   ```bash
   node src/cli.ts tools --stale --json
   node src/cli.ts presets --stale --json
   ```
   If the user named specific tools or presets, use those instead.
2. **For each tool:**
   1. Fetch `docs.mcp` (and `docs.changelog` if present).
   2. Compare with `tool.json`: paths per OS and scope, format, `rootKey`, entry fields,
      `supports.*`, `restartRequired`.
   3. Update the manifest if anything changed and add a dated line to the *Changelog* in `GUIDE.md`.
   4. Always bump `lastVerified` to today; set `verifiedVersion` if you know the tool version.
3. **For each preset:**
   1. Look up the latest version (npm, PyPI, container registry) and read the release notes since
      the pinned version.
   2. Watch for breaking changes: renamed env vars, changed args, new auth.
   3. Bump the pinned version, update the guide if needed, and bump `lastVerified`.
4. **Verify:**
   ```bash
   npm run gen:docs && npm run validate && npm test
   ```
   If the user can supply test credentials, run `doctor <preset>` in a sandbox (temp
   `WIREBAY_HOME` / `WIREBAY_USER_HOME`).
5. **Changeset:** one `patch` changeset summarising the refresh, e.g. "Re-verified cursor, vscode;
   bumped netlify to 1.16.0".
6. **Report** a table: item, what changed, how it was verified (docs only / real install / handshake).

## Hard rules

- Official sources only. If something can't be confirmed, don't change it; report it instead.
- Never touch the user's real configs or secrets.
- Don't bump a version you couldn't verify starts correctly (at least a sandboxed handshake), unless
  the user agrees.
