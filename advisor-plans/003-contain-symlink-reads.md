# Plan 003: Contain workspace-file reads after symlink resolution

## Status
- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: 001
- **Category**: security
- **Planned at**: commit `9cb16ca8`, 2026-07-14

## features/show case
- Remote workspace browsing cannot read a file or directory whose resolved target escapes the agent worktree.
- Legitimate in-tree files and safe in-tree symlinks remain readable if the chosen policy allows them.

## designs overview
`resolve()` containment is lexical, while `stat()` and `readFile()` follow symlinks. Canonicalize the worktree root and target with `realpath`, then enforce path-segment containment. Directory traversal must avoid following escaping symlinks and must remain bounded by existing hidden/binary/size rules.

## new deps
- None.

## Scope
**In scope**:
- `src/cli/chhlat/workspace-files.ts`
- `src/cli/chhlat/chhlat.ts` for the required async call-site
- existing/new focused tests under `src/cli/chhlat`

**Out of scope**: general filesystem browser redesign, write support, remote protocol changes, `skills-lock.json`.

## TODOS
- [x] Add an async canonical containment helper using `realpath`.
- [x] Apply it before file reads and directory listings.
- [x] Choose and document whether safe in-root symlinks are supported or all symlinks are rejected.
- [x] Preserve 1 MB and text-extension checks.

### test cases
- [x] Normal nested file succeeds.
- [x] `../` escape is rejected.
- [x] File symlink to outside root is rejected.
- [x] Directory symlink to outside root is rejected.
- [x] Safe in-root symlink follows the documented policy.
- [x] CLI focused tests and global gates pass.

## STOP conditions
- Stop if production callers require synchronous validation; propose the smallest async call-site change explicitly.
- Stop if Windows path behavior cannot be tested with platform-neutral fixtures.
