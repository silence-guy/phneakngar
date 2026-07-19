# Plan 023: Activity feed load-error honesty

> **Drift check**: `git diff --stat 4b268440..HEAD -- src/web/src/app/(app)/w/[slug]/activity/ src/web/src/app/(app)/w/[slug]/approvals/`

## Status

- **Status**: DONE (see README for 024 operator pending)
- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: direction / UX
- **Planned at**: commit `4b268440`, 2026-07-19

## Why this matters

Activity (and Approvals) treat load failure like an empty list. Operators cannot tell “quiet company” from “API broken.” Residual accepted as non-blocker; this plan closes it for **Activity** first (primary residual call-out), with optional Approvals parity.

## Current state

`src/web/src/app/(app)/w/[slug]/activity/page.tsx` — `load()`:

```ts
try {
  const result = await listActivityEvents(workspaceId, { limit: 50 });
  setItems(result.items);
} catch {
  setItems([]);
} finally {
  setLoading(false);
}
```

Empty UI always uses `ACTIVITY_LABELS.empty.none`.

Automations already uses `toast.error("Failed to load …")` on list failure — **match that pattern**.

## Design

1. Track `loadError: boolean` (or `errorMessage: string | null`).
2. On catch: `setItems([])`, `setLoadError(true)`, `toast.error(ACTIVITY_LABELS.failedToLoad)` (KM string in labels module).
3. Empty region:
   - if `loadError` → failed copy + optional Retry button calling `load()`
   - else → existing empty copy
4. On successful load: clear `loadError`.
5. DESIGN: calm, no chat bubbles; reuse skeleton dimensions so retry doesn’t CLS.

**Optional same PR**: Approvals page identical pattern (`APPROVALS_LABELS.failedToLoad`) — keep in scope if &lt; 30 lines extra; else separate commit.

## Commands

| Purpose | Command | Expected |
| --- | --- | --- |
| Labels tests | `pnpm --filter @phneakngar/web exec vitest run 'src/app/(app)/w/[slug]/activity'` | pass |
| Lint/type web files | `pnpm --filter @phneakngar/web exec tsc --noEmit` | only pre-existing better-sqlite3 OK |

## Scope

**In scope**
- `src/web/src/app/(app)/w/[slug]/activity/page.tsx`
- `src/web/src/app/(app)/w/[slug]/activity/activity-labels.ts`
- `src/web/src/app/(app)/w/[slug]/activity/activity-labels.test.ts`
- Optional: `approvals/page.tsx` + `approvals-labels.ts` + test

**Out of scope**
- New API error envelope shape  
- Realtime activity websocket  
- Changing activity emitters  

## Steps

### Step 1: Labels

Add KM (and keep module style):

```ts
failedToLoad: "…",
retry: "…",
empty: { none: existing, loadFailed: "…" } // or single failedToLoad for body
```

**Verify**: label tests for Khmer / non-empty strings.

### Step 2: Page state machine

States: `loading` | `error` | `empty` | `list`.

```ts
const [loadError, setLoadError] = useState(false);
// load:
setLoadError(false);
try { ... setItems(...); }
catch { setItems([]); setLoadError(true); toast.error(...); }
```

UI branch order: loading → error (with Retry) → empty → list.

**Verify**: manual reasoning + unit test pure helper if you extract `resolveActivityListView({ loading, loadError, count })` → `"loading"|"error"|"empty"|"list"` (preferred for testability).

### Step 3 (optional): Approvals parity

Same loadError + toast + retry.

## Test plan

- Pure `resolveActivityListView` tests (4 cases)  
- Labels tests  
- No MSW required  

## Done criteria

- [ ] Failed load ≠ “no activity yet” copy  
- [ ] toast.error on failure  
- [ ] Retry re-invokes load  
- [ ] Successful load clears error  
- [ ] thin-scrollbar retained  
- [ ] Tests pass  

## STOP conditions

- `listActivityEvents` / toast import patterns differ from automations — adapt to existing `@/lib/api` + `sonner`  
- Product asks for inline banner instead of toast — either is fine; pick one and stay consistent with automations  

## Maintenance notes

If Activity gains pagination later, keep error state independent of item cache.
