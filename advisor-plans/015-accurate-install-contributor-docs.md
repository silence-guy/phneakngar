# Plan 015: Publish accurate installation and contributor documentation

## Status
- **Status**: DONE
- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: 001, 012
- **Category**: docs / dx
- **Planned at**: commit `9cb16ca8`, 2026-07-14

## features/show case
- The first quick-start path works with the package’s actual publication status.
- Toolchain and package ownership match authoritative manifests.
- Current testing origin/domain is described without presenting it as permanent canonical identity.

## designs overview
Treat `package.json`, `pnpm-workspace.yaml`, `docs/source-map.md`, and Plan 012’s identity contract as authoritative. If npm packages remain unpublished, make tarball/local install primary and npm install clearly conditional. Avoid embedding versioned tarball filenames that drift after releases where a glob or generated command is safer.

## new deps
- None.

## Scope
**In scope**:
- `README.md`
- `README.km.md`
- `INSTALL.md`
- `CONTRIBUTING.md`
- `src/app/README.md`
- `docs/source-map.md` only if needed
- documentation validation scripts/guardrails only if narrowly useful

**Out of scope**: publishing npm packages, DNS changes, product marketing redesign, `skills-lock.json`.

## TODOS
- [x] Verify current npm publication state without exposing private repository metadata.
- [x] Put the currently working install method first; keep future npm commands conditional until published.
- [x] Align Node, pnpm, Bun, package count, and package ownership with manifests/source map.
- [x] Correct the web/app architecture diagram labels.
- [x] Describe `cieee.xyz` and the workers.dev origin as live-testing deployment values only.
- [x] Provide a valid language-navigation path for English and Khmer readers.

### test cases
- [x] Every referenced local file/link exists.
- [x] Every command uses current package names and supported tool versions.
- [x] No prose claims `cieee.xyz` is permanent canonical identity.
- [x] `pnpm check:project` passes after docs changes.
- [x] Global gates pass.

## STOP conditions
- Stop if a permanent public website/email domain must be chosen; ask the user rather than inventing one.
