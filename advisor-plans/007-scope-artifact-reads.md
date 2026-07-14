# Plan 007: Scope artifact reads to conversation owners

## Status
- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: 001
- **Category**: security
- **Planned at**: commit `9cb16ca8`, 2026-07-14

## features/show case
- Artifact metadata, content, and thumbnails require the owning conversation user.
- Authenticated thumbnails are never publicly cacheable.

## designs overview
Collection/upload routes already require `conversation.userId === ctx.userId`; content routes only check agent access. Encode ownership in a shared query joining artifact to conversation and filtering artifact ID, workspace ID, and user ID before returning R2 keys. Use private cache headers unless a future explicit sharing model exists.

## new deps
- None.

## Scope
**In scope**:
- `src/shared/src/db/queries/artifact.ts`
- shared artifact query tests
- `src/web/src/app/api/artifacts/[id]/route.ts`
- `src/web/src/app/api/artifacts/[id]/content/route.ts`
- `src/web/src/app/api/artifacts/[id]/thumbnail/route.ts`
- corresponding route tests

**Out of scope**: public artifact sharing, upload format, R2 key redesign, `skills-lock.json`.

## TODOS
- [x] Add an ownership-scoped artifact query.
- [x] Switch content and thumbnail routes to it before R2 access.
- [x] Return identical 404 responses for missing/unauthorized rows.
- [x] Change thumbnail caching to `private` or `no-store` consistent with authenticated content.

### test cases
- [x] Owner reads content and thumbnail.
- [x] Same-workspace user with shared-agent access receives 404 for another user’s artifact.
- [x] Cross-workspace access receives 404.
- [x] Unauthorized requests never call R2.
- [x] Thumbnail response cannot be stored by shared caches.
- [x] Focused shared/web tests and global gates pass.

## STOP conditions
- Stop if a documented artifact-sharing model exists; report it rather than silently narrowing intended access.
