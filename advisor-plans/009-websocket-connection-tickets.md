# Plan 009: Replace WebSocket session tokens with connection tickets

## Status
- **Priority**: P1
- **Effort**: L
- **Risk**: MED
- **Depends on**: 001
- **Category**: security
- **Planned at**: commit `9cb16ca8`, 2026-07-14
- **Phase D remediation**: complete and verified locally; no external dependencies added.

## features/show case
- Browser JavaScript never receives the long-lived Better Auth session token.
- WebSocket identity is authenticated before selecting/allocating a Durable Object.
- Unauthenticated connections expire quickly and cannot keep silent sockets open indefinitely.

## designs overview
Issue a short-lived signed ticket from the authenticated web route. The ticket must include audience, user/chhlat identity, expiry, and a replay policy; use existing Web Crypto/secret infrastructure and no new package. The custom Worker or WS Worker must validate the ticket before `idFromName`. Keep service-binding authentication separate from end-user authentication. Coordinate browser and chhlat reconnect compatibility.

Phase D remediation status: user sockets use `user-ws` tickets; chhlat sockets use `chhlat-ws` tickets bound to user, workspace, and token-recorded hostname. The public ws-do router validates tickets before Durable Object selection for both audiences, and the chhlat DO name includes `workspaceId` plus `chhlatId` so workspace-unique machine IDs cannot collide. The DO consumes each nonce once in storage and performs bounded expired-nonce cleanup from DO storage; public unauthenticated chhlat handshakes no longer enter a DO.

Rolling compatibility status: there is no safe new-browser-to-old-ws-do overlap without putting a Better Auth session token back into the WebSocket URL or changing the old ws-do first. `DEPLOY.md` therefore documents a coordinated web/ws-do protocol-pair cutover and pair rollback; older CLIs without ticket support lose WS push after ws-do is tightened but continue HTTP polling.

## new deps
- None expected. Use Web Crypto and existing secrets.

## Scope
**In scope**:
- `src/web/src/app/api/ws/token/route.ts`
- its tests
- `src/web/src/lib/use-user-ws.ts`
- `src/web/custom-worker.ts`
- `src/ws-do/src/index.ts`
- `src/ws-do/src/ws-durable.ts`
- WS worker tests
- shared ticket schema/crypto helper only if needed
- environment typings/examples for a dedicated ticket secret only if existing service secret is unsuitable

**Out of scope**: general session configuration, broadcast payload redesign, `skills-lock.json`.

## TODOS
- [x] Define a versioned ticket payload and signature/expiry validation.
- [x] Issue tickets only after Better Auth session validation or machine-token validation.
- [x] Validate tickets before deriving DO names; never trust query identity alone.
- [x] Remove normal session-token exposure from JSON and socket auth messages.
- [x] Replace public unauthenticated chhlat handshakes with pre-upgrade tickets and durable single-use nonce consumption.
- [x] Bind chhlat WebSocket auth to the token-recorded hostname as well as user/workspace.
- [x] Maintain staged compatibility or document a coordinated web/ws-do deployment order.

### test cases
- [x] Valid current ticket connects to its own identity.
- [x] Expired, malformed, wrong-audience, wrong-user, and tampered tickets fail before DO allocation.
- [x] Reconnect obtains a fresh ticket.
- [x] Replayed ticket nonce is rejected by Durable Object storage.
- [x] Cross-user and cross-chhlat routing is rejected.
- [x] Same hostname in another workspace is rejected/routed to a separate DO before allocation and cannot receive cross-workspace broadcasts.
- [x] Web, ws-do, shared, and CLI focused tests plus typecheck, lint, build, OpenNext build, Wrangler dry-runs, and global gates pass.

## STOP conditions
- Stop if the chosen deployment cannot validate the ticket before DO selection; propose a compatible two-stage routing design.
- Stop if rollout requires breaking all current CLIs without a compatibility window; report the protocol/version plan.
