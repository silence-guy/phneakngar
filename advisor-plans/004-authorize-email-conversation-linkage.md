# Plan 004: Authorize outbound-email conversation linkage

## Status
- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: 001
- **Category**: security
- **Planned at**: commit `9cb16ca8`, 2026-07-14

## features/show case
- `conversationId` is accepted only when it belongs to the requesting user, workspace, and selected agent.
- Invalid conversation IDs cannot receive email event messages or future reply mappings.

## designs overview
The route authorizes the sender agent but resolves an optional conversation only by ID and workspace. Follow repository ownership rules: scope before fetching through a shared query that includes workspace, user, and agent predicates. Treat an unauthorized conversation as absent without exposing its existence.

## new deps
- None.

## Scope
**In scope**:
- `src/shared/src/db/queries/conversation.ts`
- corresponding shared query tests
- `src/web/src/app/api/email/send/route.ts`
- `src/web/src/app/api/email/send/route.test.ts`

**Out of scope**: delivery idempotency (Plan 011), domain configuration (Plan 012), `skills-lock.json`.

## TODOS
- [x] Add/reuse a conversation lookup scoped by ID, workspace ID, user ID, and agent ID.
- [x] Use it before local or remote mapping/event creation.
- [x] Keep unauthorized and nonexistent responses indistinguishable.

### test cases
- [x] Owned conversation maps and receives the event.
- [x] Same-workspace different-user conversation creates no mapping/message.
- [x] Same-user wrong-agent conversation creates no mapping/message.
- [x] Cross-workspace conversation creates no mapping/message.
- [x] Shared and web focused tests plus global gates pass.

## STOP conditions
- Stop if product requirements intentionally allow cross-user shared conversations; report the existing sharing model and authorization source.
