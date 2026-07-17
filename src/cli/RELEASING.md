# Releasing @phneakngar/cli

All workspace packages share one version. Prefer the monorepo release path:

```bash
# from repo root — after quality gates
pnpm bump patch   # or minor / major / explicit 0.0.3
git push origin main
```

A commit message of the form `release: vX.Y.Z` triggers:

1. CI quality gates
2. Auto-tag + GitHub Release (`auto-tag-release.yml`)
3. **Publish CLI** (`publish-cli.yml`) when `src/cli/package.json` changes on that release commit
4. **Publish app** (`publish-app.yml`) similarly for `@phneakngar/app`

Publishing from the private GitHub repository uses the GitHub Actions secret `NPM_TOKEN`.
Create a granular npm access token that can publish `@phneakngar/cli` and `@phneakngar/app`, enable 2FA bypass for automation, then store it as `NPM_TOKEN` in the repository secrets before running the publish workflows.
The npm package 2FA setting must allow token-based publishing; do not select a package setting that disallows tokens.

## Pre-publish verification (required for client readiness)

From the monorepo root:

```bash
pnpm --filter @phneakngar/cli test
pnpm --filter @phneakngar/cli typecheck
node scripts/verify-cli-package.mjs
```

Manual equivalent:

```bash
cd src/cli
pnpm run build
node dist/index.js version
node dist/index.js doctor --skip-network
npm pack --dry-run
npm pack
# install tarball into a temp project and run version/doctor (verify script does this)
```

## Package contents

Published files (see `files` in `package.json`):

- `dist/index.js` — CLI entry (`bin.phneakngar`)
- `dist/session-runner.js`, `dist/meeting-runner.js` — worker entrypoints
- `README.md`, `LICENSE`

Runtime dependencies: `citty`, `commander`, `playwright-core`, `postal-mime`, `sharp`.  
`@phneakngar/shared` is **bundled into** the dist artifacts (devDependency only).

## Prereleases

Use an explicit version via `pnpm bump 1.2.3-beta.1` if you need a prerelease line. Confirm dist-tag behavior on npm before promoting to `latest`.

## Rolling back

Within 72h:

```bash
npm unpublish @phneakngar/cli@X.Y.Z
```

After 72h:

```bash
npm deprecate @phneakngar/cli@X.Y.Z "broken release, please upgrade to X.Y.Z+1"
```

## Client install after publish

```bash
npm install --global @phneakngar/cli
phneakngar init
phneakngar doctor
phneakngar login
phneakngar chhlat start
```

Full client docs: [INSTALL.md](../../INSTALL.md).

For full local self-hosted installs, `@phneakngar/app` has its own verifier:

```bash
node scripts/verify-app-package.mjs
```

Run both package verifiers before a release that may be installed on another device.
