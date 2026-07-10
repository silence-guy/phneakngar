# Release Checklist

All workspace packages share one version. Use `pnpm bump` as the release path.

## Before Bump

- Run `pnpm check:project`.
- Run `pnpm typecheck`.
- Run `pnpm lint`.
- Run `pnpm test`.
- Confirm D1 migrations are present for schema changes.
- Confirm package names, env names, and docs use current `phneakngar` naming.

## Bump Commands

```bash
pnpm bump patch
pnpm bump minor
pnpm bump major
pnpm bump 0.0.11
```

Use flags when needed:

```bash
pnpm bump patch --min-cli
pnpm bump patch --desktop
pnpm bump patch --mobile
```

## Flag Rules

- Use `--min-cli` when web/API behavior requires users to upgrade the CLI.
- Use `--desktop` when desktop app code, native config, icons, or updater behavior changed.
- Use `--mobile` when mobile/native generated files or mobile app behavior changed.

## After Bump

Review the generated `release: vX.Y.Z` commit, then push `main`.

```bash
git push origin main
```

CI handles tagging, GitHub release generation, and npm publication for CLI/app.
Cloudflare Workers are **not** auto-deployed — after push, run manually:

```bash
pnpm deploy:ws-do
pnpm deploy:email
pnpm deploy:web
```
