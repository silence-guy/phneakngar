# Data And State Boundaries

`ភ្នាក់ងារ` must remain stateless at the service layer. Durable state belongs in durable storage, and query ownership must be scoped before fetching rows.

## Query Ownership Rule

Always include the owning scope in the query predicate before reading data:

- Workspace-owned data: filter with `workspaceId`.
- User-owned data: filter with `userId` and, when applicable, `workspaceId`.
- Agent-owned data: filter with `agentId` and `workspaceId`.
- Runtime/chhlat data: filter with `chhlatId`, `runtimeId`, or `workspaceId` before returning rows.

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

## Delivery and Retry Idempotency

Every operation that can be retried by Cloudflare, a Durable Object alarm, email infrastructure, WebSocket reconnect logic, or the CLI must remain correct when delivered more than once.

Repository conventions:

- Inbound email uses a deterministic delivery key with a workspace-scoped D1 unique constraint.
- Cloudflare Email Routing derives the key from the agent and raw-message digest.
- IMAP delivery derives the key from the account and UID and advances the durable cursor after each successful notification.
- Email-triggered conversations, messages, tasks, and meetings use deterministic IDs and conflict-safe inserts.
- R2 keys for retryable inbound email and meeting artifacts are deterministic and include the owning workspace or account scope.
- Machine-token lookup uses a one-way digest; active plaintext token values are redacted after activation or lazy migration.
- WebSocket connection state may be lost and reconstructed, but authorization and queued task truth remain in D1 or Durable Object storage.

Do not implement duplicate suppression only with a module-level `Set`, a process-local cache, or an acknowledgement that can be lost before durable state is updated.

## R2 Ownership Rule

Before reading, replacing, or deleting an R2 object, first resolve a D1 row using the complete workspace/user/agent scope and verify that the stored R2 key belongs to that row. Draft attachment keys must pass the repository's scoped key validators before the Worker reads them.

New R2 key formats should include enough stable ownership context to support audits and deterministic retries without exposing credentials or personal data in the key.

## Cross-Service Authentication

- Web and Email Workers share `EMAIL_NOTIFY_SECRET` and authenticate requests in both directions.
- Web and WebSocket Workers share `WS_SERVICE_SECRET`.
- Secret comparisons use constant-time digest comparison where appropriate.
- Internal Worker routes fail closed when a required secret is absent.
- Health endpoints may remain unauthenticated but must not expose configuration names, credentials, or sensitive state.
- Raw machine tokens and secret prefixes must not appear in KV keys, logs, traces, errors, or API responses after activation.

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
