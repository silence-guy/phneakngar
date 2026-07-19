# Plan 016: Ship workspace Activity feed UI

> **Executor instructions**: Follow step by step. Verify each step. Touch only in-scope files. Update `advisor-plans/README.md` status when done (unless reviewer maintains index).
>
> **Drift check**: `git diff --stat 6a6c7699..HEAD -- src/web/src/app/(app)/w/[slug]/ src/web/src/components/app-sidebar.tsx src/web/src/lib/locale.ts src/web/src/lib/api/activity.ts`

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: direction
- **Planned at**: commit `6a6c7699`, 2026-07-19

## Why this matters

`activity_event` + `GET /api/activity` + `listActivityEvents` already exist, but there is no workspace UI. Shipping the feed turns residual commercial foundations into a user-visible company pulse without claiming full Helio parity.

## Current state

- API: `src/web/src/app/api/activity/route.ts` returns `{ items: [...] }` workspace-scoped.
- Client: `src/web/src/lib/api/activity.ts` → `listActivityEvents`.
- Sidebar icons: Home, Inbox, Flags, Issues, Calendar, Approvals, Automations in `app-sidebar.tsx` (~409–490). No Activity route.
- Pattern to clone: `src/web/src/app/(app)/w/[slug]/approvals/page.tsx` (client list + skeleton + labels).

## Commands

| Purpose | Command | Expected |
|---|---|---|
| Labels/unit | `pnpm --filter @phneakngar/web exec vitest run src/app/\(app\)/w/\[slug\]/activity` | pass |
| Locale | `pnpm --filter @phneakngar/web exec vitest run src/lib/locale.test.ts` | pass |
| Typecheck web | `pnpm --filter @phneakngar/web typecheck` | exit 0 |

## Scope

**In scope**
- `src/web/src/app/(app)/w/[slug]/activity/page.tsx` (create)
- `src/web/src/app/(app)/w/[slug]/activity/activity-labels.ts` (create)
- `src/web/src/app/(app)/w/[slug]/activity/activity-labels.test.ts` (create)
- `src/web/src/components/app-sidebar.tsx`
- `src/web/src/lib/locale.ts` (`webNavigationLabels` + `appShellCopy.activity`)
- `src/web/src/lib/locale.test.ts` (if needed for new key)

**Out of scope**
- New activity emitters / schema / migrations
- Agent-level `/agents/[id]/activity` changes
- Realtime websocket feed

## Git workflow

- Branch optional: work on current branch
- Commits: `feat(web): workspace activity feed UI`

## Steps

### Step 1: Labels module

Create KM/EN labels (match approvals-labels pattern — KM default constants OK if co-located; also add EN via locale for appShell).

Kinds known today: approval decide, gateway egress, probe, automation_due — map icons + fallback for unknown kind.

**Verify**: unit tests for kind label + empty copy.

### Step 2: Activity page

Client page: load `listActivityEvents(workspaceId, { limit: 50 })`, skeleton rows matching loaded row height, empty state, `thin-scrollbar`, `relativeTime`, DESIGN calm list (no chat bubbles).

**Verify**: page compiles; vitest labels pass.

### Step 3: Sidebar + locale

Add Activity nav button (Activity icon from lucide, e.g. `Activity` or `Radio`) between Approvals and Automations (or after Home). Wire `appShellLabel("activity")` + `webNavigationLabels.activity`.

**Verify**: `locale.test.ts` still green; grep sidebar for `/activity`.

## Test plan

- `activity-labels.test.ts`: kind labels, empty string, unknown kind fallback
- No full RTL required if pure labels covered (match approvals-labels style)

## Done criteria

- [ ] `/w/[slug]/activity` page exists and lists API items
- [ ] Sidebar navigates to activity
- [ ] EN + KM labels present
- [ ] `thin-scrollbar` on overflow list
- [ ] Tests pass; no secret values in UI
- [ ] No files outside scope

## STOP conditions

- API shape no longer `{ items }`
- Sidebar pattern substantially rewritten

## Maintenance notes

New `activity_event.kind` values need label map entries. Keep feed honest: MVP company pulse, not full timeline parity.
