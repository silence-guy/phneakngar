# Code review: blank chat after registration / active-task panel + welcome email UX

**Reviewer role:** lazycodex-code-reviewer (read-only)  
**Date:** 2026-07-15  
**Scope:** empty-state resolver + agent-chat empty frame + welcome seed messages + labels/prompts

## Skill-perspective check

| Skill | Ran? | Result |
| --- | --- | --- |
| `remove-ai-slops` | Yes — criteria loaded from `~/.grok/plugins/omo/skills/remove-ai-slops/SKILL.md` | **Violations:** (1) seed path invents a message shape the renderer does not understand (`event` + free text) = boundary/wrong-layer product bug; (2) dual mechanisms (seed + empty frame) without one coherent render path; (3) studio/agent tests assert role/taskId/Khmer but not **renderability**; (4) labels tests partially tautological (Khmer regex on a subset of strings). |
| `programming` | Yes — criteria loaded from `~/.grok/plugins/omo/skills/programming/SKILL.md` (+ shared axioms: exhaustive match, parse-don't-validate, test shape) | **Violations:** empty-kind discrimination via `if` chain (no `assertNever`); task status typed as bare `string`; empty `catch {}` on seed path; no consumer-facing test that seed content is a lifecycle note / system line. |

## Verdict

**FAIL** — `codeQualityStatus: BLOCK`, `recommendation: REQUEST_CHANGES`

The empty-state pure function is directionally correct and unit-tested. The production **seed** path is wrong for the existing chat renderer and actively suppresses the empty-frame UX (including stuck CTA) whenever seeds land.

---

## Findings (by severity)

### CRITICAL

#### C1. Welcome seeds use `MessageRole.EVENT` but the UI only knows event cards (email / issue / calendar)

**Files:**
- `src/web/src/app/api/studios/route.ts` ~241–248, 283–289  
- `src/web/src/app/api/agents/route.ts` ~110–116  
- `src/web/src/components/agent-chat/message-list.tsx` ~717–767  
- `src/web/src/components/agent-chat/chat-message-utils.ts` ~6–34  

**What ships:**

```ts
role: MessageRole.EVENT,
content: WELCOME_*_SEED_EVENT, // plain Khmer prose
metadata: JSON.stringify({ event_type: "welcome_*_queued" }),
```

**What the UI does for `role === "event"`:** always runs `parseEventData` → `EmailCard` | `IssueCard` | `CalendarCard`. There is **no** branch for free-text system copy or `event_type: "welcome_*"`.

**Classification path:**

1. `eventTypeFromMessage` ignores `event_type`; only `issueId` / `emailId` / `calendarEventId` or content/conversationType heuristics.
2. **Welcome email** conv type is `email_notification` → classified as **email** → `EmailCard` with `subject = full Khmer seed`, `address = ""` (no ASCII `": "` in content).
3. **Welcome chat** conv type is `user_dm_message` → not email/issue/calendar type; Khmer body has no `"email"` / `"issue "` → falls through to **calendar** → **`CalendarCard`** with the seed string as title.

**Why this is critical:** the seed is the API-side “fix blank chat” path. It does not render as a system line; it mis-renders as a resource card. Lifecycle system lines already exist as:

```ts
role: "assistant",
metadata: JSON.stringify({ kind: "lifecycle" }),
```

(`task.ts` cancel path; `message-list.tsx` `isLifecycleNote`.) Seeds ignore that contract.

**Also:** once any message exists, `resolveChatEmptyState` returns `"none"` (`chat-empty-state.ts:60`). Successful seeds **kill** the empty frame (welcome / working / **stuck + Open Runtime**). Stuck guidance never appears on the happy seed path.

---

### HIGH

#### H1. `welcome-email` mis-fires for non-email active tasks on new agents (default channel)

**Files:**
- `src/web/src/components/agent-chat/chat-empty-state.ts` ~67–74  
- `src/web/src/components/agent-chat/agent-chat-view.tsx` ~822–824  

```ts
const welcomeEmailTask =
  input.activeTaskType === "email_notification" ||
  (input.isNewAgent && input.hasEmailTask && input.activeChannel === "default");
```

Studio welcome **chat** is `user_dm_message`. With `isNewAgent` and `hasEmailTask` true (studio often has both email + chat tasks; `hasEmailTask` also ORs **any** `activeTaskCounts[agentId] > 0`), an empty welcome-chat conversation with an active DM task gets **Mail icon + welcome-email copy**, not `active-working`.

**Missing test:** active `user_dm_message` + `isNewAgent` + `hasEmailTask` + default must **not** be `welcome-email`.

#### H2. `hasEmailTask` is not email-specific

**File:** `agent-chat-view.tsx` ~822–824  

```ts
const hasEmailTask =
  (activeTaskCounts[agentId] ?? 0) > 0 ||
  (isTaskActive && activeTask?.type === "email_notification");
```

Any active task on the agent flips `hasEmailTask`. Combined with the idle branch (`chat-empty-state.ts` ~76–81), a brand-new agent with a non-email task elsewhere still shows **welcome-email** on an empty default channel. Misleading and untested.

#### H3. `POST /api/agents` seed path is untested (and mocks would not exercise it)

**File:** `src/web/src/app/api/agents/route.test.ts`  

No assertions on `createMessage` / seed content / role. Shared mock for this file does not wire `queries.conversation` / `queries.message` / `queries.whitelist` the way production uses them — welcome block is best-effort `catch {}`, so failures are silent and tests stay green without seeds.

Studios tests assert seed role=`event` + Khmer + taskId — which **locks the wrong role** (see C1).

---

### MEDIUM

#### M1. Stuck CTA only when `messageCount === 0`

By design of `resolveChatEmptyState`, seeds (or any prior message) disable `active-stuck`. Even after fixing C1 to lifecycle notes, stuck → `/runtimes` still will not show if a seed message exists. If stuck UX is required for welcome registration with offline runtime, need either:

- empty-frame alongside system seed (don't gate solely on `messageCount > 0`), or  
- no seed + empty frame only, or  
- stuck chrome outside the empty frame (e.g. banner when task age + status match).

#### M2. Non-exhaustive kind rendering in `agent-chat-view.tsx`

~843–906: `if (emptyKind === "none" | "welcome-email" | "active-working" | "active-stuck")` then default `say-hi`. Programming skill wants `switch` + `assertNever` so a new kind is a compile-time break.

#### M3. Unit coverage gaps on pure resolver

Covered well: messages exist → none; idle new+email default → welcome-email; email_notification active → welcome-email; non-email working; stuck threshold; running never stuck; non-default idle → say-hi.

**Missing:**

- terminal statuses (`completed`/`failed`/…) → `say-hi` / not active  
- active `user_dm_message` + new agent + hasEmailTask (H1)  
- stuck wins over welcome (partially covered for email stuck)  
- `activeTaskAgeMs: null` with queued never stuck  
- idle new agent with `hasEmailTask` false → say-hi  

#### M4. Labels tests miss new welcome copy keys

`agent-chat-labels.test.ts` checks `activeWorkingTitle` / `activeStuckTitle` / `openRuntimes` but not `welcomeEmailTitle` / `welcomeEmailSubcopy` / `activeWorkingSubcopy` / `activeStuckSubcopy`.

#### M5. Best-effort empty `catch` on seed

Pre-existing studio/agent pattern; still swallows enqueue **and** seed failures without log. Seed-only failures leave task running with empty chat (empty frame then becomes the real fix — good) but operators get no signal.

---

### LOW

#### L1. IIFE block inside JSX (`agent-chat-view.tsx` ~815–907)

Works, but hard to test and re-renders decision logic inline. Prefer `useMemo` for `emptyKind` + small presentational component.

#### L2. `renderNow` frozen at mount for 5‑minute `isNewAgent`

`useState(() => Date.now())` — window never advances within a long-lived mount. Edge only.

#### L3. Khmer-regex constant tests (`welcome-prompts.test.ts` seed constants)

Weak lock (any Khmer char passes). Prefer exact equality to the exported strings if pinning copy.

#### L4. Redundant `welcomeEmailTask` construction vs idle branch

Same predicate appears twice; fine but easy to drift.

---

## Missed edge cases

1. **Seed succeeds → empty UX never runs** (including stuck CTA).  
2. **Welcome chat seed → CalendarCard** (worst mis-render).  
3. **Welcome email seed → EmailCard** with empty address, non-clickable.  
4. **New agent + studio dual tasks** → chat task conversation shows email empty frame if no seed.  
5. **Offline runtime at creation** → no enqueue/seed (gated on `isOnline`); user opens empty chat → say-hi / no stuck unless a task exists.  
6. **User lands on default channel**, not the email_notification welcome conversation — seeds on another conv do not fill the open chat; empty frame must carry UX (it can, if hasEmailTask + isNewAgent heuristics fire — fragile).  
7. **Panel open of active non-welcome task** with empty messages → `active-working` / `active-stuck` (good); no seed needed.  
8. **Invalid / missing `created_at` on task** → `ageMs` NaN → never stuck.  
9. **`activeTaskCounts` lag after invalidate** → brief wrong empty kind.  
10. **Whitelist welcome** (`agents/[id]/whitelist`) still no seed — OK if only registration path was in scope.

---

## Concrete fix recommendations (smallest diffs)

### 1. Fix seed role/metadata (addresses C1) — preferred smallest API fix

In `studios/route.ts` and `agents/route.ts`, match cancel lifecycle notes:

```ts
await queries.message.createMessage(db, {
  conversationId: conv.id,
  role: MessageRole.ASSISTANT, // not EVENT
  content: WELCOME_EMAIL_SEED_EVENT, // or CHAT seed
  taskId: emailTask.id,
  metadata: JSON.stringify({
    kind: "lifecycle",
    event_type: "welcome_email_queued", // optional extra
  }),
});
```

Update `studios/route.test.ts` to expect `role: "assistant"` and `metadata` containing `kind: "lifecycle"` (not `"event"`).

Add parallel assertions to `agents/route.test.ts` with full query mocks.

Optional: one message-list / utils test that `kind: "lifecycle"` + assistant renders system line path (if not already covered elsewhere).

### 2. Tighten welcome-email classification (H1/H2)

In `chat-empty-state.ts`, only treat as welcome-email when:

- `activeTaskType === "email_notification"`, **or**
- idle: `isNewAgent && hasEmailTask && activeChannel === "default"` **and** no non-email active task on this conversation.

In the view, compute:

```ts
const hasEmailTask =
  isTaskActive && activeTask?.type === "email_notification"
  // optional: OR agent-level email_notification count if you have typed counts
```

Do **not** use raw `activeTaskCounts[agentId] > 0` as “email”.

Add unit tests for H1.

### 3. Decide dual-path product rule (M1)

Pick one:

| Option | When to use |
| --- | --- |
| **A. Empty frame only** | Delete seeds; rely on empty kinds (stuck CTA works). |
| **B. Lifecycle seed only** | Keep seeds as assistant lifecycle; accept no stuck empty frame (or add banner). |
| **C. Both** | Allow empty kinds when the only messages are lifecycle seeds with welcome event_type (special-case `messageCount` filter). |

Current code is A+B half-done and broken.

### 4. Exhaustive UI switch (M2)

```ts
switch (emptyKind) {
  case "none": return null;
  case "welcome-email": return <...>;
  case "active-working": return <...>;
  case "active-stuck": return <...>;
  case "say-hi": return <...>;
  default: assertNever(emptyKind);
}
```

### 5. Tests to add (minimal set)

- `resolveChatEmptyState`: H1 case; terminal status; null ageMs.  
- `POST /api/agents`: seed createMessage called with assistant + lifecycle + taskId.  
- `POST /api/studios`: fix expected role.  
- Labels: assert `welcomeEmailTitle` / subcopy match Khmer (or exact strings).

---

## What looks solid

1. **Root diagnosis of blank chat is correct:** TaskStream is errors-only; gating empty UI on `!activeTask` was wrong. Comment + `messages.length === 0 && flex min-h-full` layout fix is sound (`agent-chat-view.tsx` ~765–768, 811–814).  
2. **`resolveChatEmptyState` pure module** is small, testable, priority order (stuck > welcome > working > idle welcome > say-hi) is sensible.  
3. **Stuck only for `queued`/`dispatched`**, not `running` — correct product choice; unit-tested.  
4. **Labels** for stuck + Open Runtime + working/welcome copy in Khmer are in place; router.push `/w/${slug}/runtimes` is right.  
5. **Seed includes `taskId`** — good for correlation / future filtering.  
6. **Welcome prompts** still force Khmer subjects/body rules; seed strings are Khmer constants in `welcome-prompts.ts`.  
7. **Studios tests** at least call `createMessage` twice and pin taskId — good skeleton once role is fixed.  
8. **Polling every 3s** `setActiveTask` re-renders so age-based stuck can appear without a dedicated timer when messages are empty.

---

## Return summary

| Field | Value |
| --- | --- |
| `codeQualityStatus` | **BLOCK** |
| `recommendation` | **REQUEST_CHANGES** |
| `reportPath` | `.omo/evidence/blank-chat-welcome-ux-code-review.md` |
| `blockers` | **C1** wrong seed role/render path; **H1/H2** welcome-email misclassification; **H3** agents seed untested / wrong studio expectation locks event role |

Do not approve until C1 is fixed (lifecycle assistant or drop seeds) and H1/H2 classification is tightened with tests.
