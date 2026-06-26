# Data And State Boundaries

`ភ្នាក់ងារ` must remain stateless at the service layer. Durable state belongs in durable storage, and query ownership must be scoped before fetching rows.

## Query Ownership Rule

Always include the owning scope in the query predicate before reading data:

- Workspace-owned data: filter with `workspaceId`.
- User-owned data: filter with `userId` and, when applicable, `workspaceId`.
- Agent-owned data: filter with `agentId` and `workspaceId`.
- Runtime/daemon data: filter with `daemonId`, `runtimeId`, or `workspaceId` before returning rows.

Do not fetch by broad ID and then check ownership in application code. The shared query layer in `src/shared/src/db/queries/*.ts` should encode ownership in the database query itself.

## Durable State Locations

| State | Location |
| --- | --- |
| Workspace, user, agent, runtime, conversation, task, issue, calendar, inbox metadata | D1 via `src/shared/src/db/schema.ts` |
| Raw email, attachments, generated files, large payloads | R2 buckets |
| Short-lived cache or rate-limit style data | KV, if configured |
| Local CLI install/runtime config | Local filesystem under the app/CLI configured directory |
| Browser-side chat cache | IndexedDB, because it is client-local and reconstructable |
| Live WebSocket connections | Durable Object accepted WebSocket state only |

## Ephemeral State Rule

Module-level `Map`, `Set`, or in-memory caches are allowed only for disposable acceleration. They must be safe to lose on Worker restart, deploy, isolate eviction, or process crash.

Acceptable examples:

- Deduping work within a single request.
- Memoizing read-only data with a short TTL.
- Keeping WebSocket connection attachment state inside a Durable Object.
- UI-only client state that can be reconstructed from server data.

Not acceptable:

- Ownership decisions kept only in memory.
- Task lifecycle state kept only in a Worker process.
- Runtime online/offline truth kept only in a web server variable.
- Email delivery status kept only in memory.

## Raw SQL Exceptions

Use Drizzle ORM operators by default. Raw SQL is acceptable only when Drizzle has no equivalent or the query genuinely depends on SQLite-specific behavior.

When raw SQL is used:

- Keep it inside the shared query module that owns the behavior.
- Prefer Drizzle column references over hardcoded table/column strings.
- Add a short comment when the reason is not obvious.
- Add a focused test around ownership and edge cases.

Common acceptable cases:

- Atomic increments.
- `excluded.*` upsert references.
- JSON patching.
- Partial indexes in schema definitions.
- `EXISTS` or aggregate expressions where the ORM equivalent would be less clear.

## Review Checklist

- Does the query include `workspaceId`, `userId`, `agentId`, or runtime scope before fetching?
- Does the route use a shared query/helper instead of duplicating ownership checks?
- Would correctness survive a Worker restart?
- Is any cache explicitly reconstructable?
- Does the test cover cross-workspace or wrong-user access?
