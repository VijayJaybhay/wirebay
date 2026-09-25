# Releasing

wirebay is released to npm with [Changesets](https://github.com/changesets/changesets) and GitHub
Actions, with npm **provenance**.

## For contributors

Every user-visible PR includes a changeset:

```bash
npx changeset
```

| Change                                                                  | Bump  |
| ----------------------------------------------------------------------- | ----- |
| Tool or preset data update, bug fix, docs                               | patch |
| New command, option, preset or tool                                     | minor |
| Breaking grammar, config or behaviour change (with automatic migration) | major |

## For maintainers

1. Merging PRs with changesets makes the **Release** workflow open or update a
   "Version Packages" PR (version bump + `CHANGELOG.md`).
2. Merging that PR makes the workflow run lint, tests, validate and build, then
   `npm publish --provenance --access public` and create a GitHub release.

### One-time setup

- Prefer **trusted publishing**: on npmjs.com, package settings → _Trusted publishers_ → add
  GitHub Actions for `VijayJaybhay/wirebay`, workflow `release.yml`. No token is needed.
- Otherwise, create an npm **automation** token and add it as the `NPM_TOKEN` repository secret.
- Repository settings → Actions → _Allow GitHub Actions to create and approve pull requests_.

### Manual release (emergency only)

```bash
npm run lint && npm test && npm run validate
npm run build
npm pack --dry-run      # check the file list: dist/, presets/, tools/, schemas/, templates/
npm publish --access public
```

## Before the first public release

- `npm view wirebay` should show nothing (the name is free), or you should own it.
- Check the README renders on npmjs.com: all links are absolute GitHub URLs.
