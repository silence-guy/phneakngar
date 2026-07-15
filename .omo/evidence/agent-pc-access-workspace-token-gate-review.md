# Gate review: agent-pc-access-workspace-token

**Date:** 2026-07-15  
**Role:** lazycodex-gate-reviewer (read-only)  
**recommendation:** **APPROVE**

---

## originalIntent

User hits two symptoms:

1. Agent cannot use the PC (no file/PC reachability).
2. Connect/workspace-switch UI token paste fails with `invalid token` (HTTP 401) because CLI `register` called `GET /api/me` with a **pending** machine Bearer before `activate`.

Desired product behavior: pending UI `al_*` tokens activate via register; agents can reach the machine once chhlat is online **inside agent workdir only**; clearer errors/doctor/UI; **do not** accept pending in `withAuth`; no release bump; no full-PC FS redesign.

## desiredOutcome

- `register --token al_…` activates first, saves `watched_workspaces`, no pre-activate `/api/me` 401.
- Auth still 401s pending Bearer.
- Activate failures 404/409/422/503 (+ residual 401) map to human hints.
- Doctor fails closed without usable watched token.
- Connect UI ordered next steps + sandboxed workdir note (en/km).
- Tests + typecheck/cli green; no bump.

## userOutcomeReview

| User journey | Expected | Shipped? |
| --- | --- | --- |
| First connect / workspace switch register | Pending token activates; config saved | **Yes** — `register.ts` calls `activateAndSave` first; stateful test proves 401-until-activate |
| Wrong token / server / claim | Actionable CLI error | **Yes** — `formatActivateFailure` + integration tests |
| “Why can’t agent reach PC?” | Doctor fail + register hint | **Yes** — `checkRegistration` fail-closed |
| Expectation of whole Mac FS | Explicitly not whole PC | **Yes** — UI note + doctor INFO workdir scope |
| Pending API access | Must remain denied | **Yes** — `auth.ts` still active-only; auth.test pending → 401 |

**User-visible residual (accepted non-goals):** published `npx @phneakngar/cli@0.0.1` still has pre-fix register until a future bump/publish; production smoke left optional for human.

---

## recommendation

**APPROVE**

All eight goal criteria are proven by current tree source + tests + commit history + executor/orchestrator evidence artifacts. No security non-goal violated. No unresolved overfit/slop in production or tests.

---

## blockers

_None._

---

## criteria_checklist

### G1 — Pending register no longer fails on pre-activate `/api/me` 401

- **pass:** true
- **evidence:** `src/cli/commands/register.ts` L42–55: `activateAndSave` before optional `/api/me`. Test `activates pending machine token that fails pre-activate GET /api/me` in `register.test.ts` (stateful `activated` flag; assert activate index &lt; me index; save config; no exit 1). RED artifact then GREEN: `.omo/evidence/.../wp1/red-register-test.txt`, `green-register-tests.txt`, `orchestrator-reverify.txt`. Commit `791ee742`.

### G2 — activateAndSave before Bearer `/api/me`; post-activate `/api/me` non-fatal

- **pass:** true
- **evidence:** Same `register.ts` order; try/catch around `/api/me` with empty email fallback (L47–55). Test `still succeeds when post-activate GET /api/me fails` (500 body; still saves; no “Registered as”).

### G3 — auth.ts still rejects pending (must NOT accept pending)

- **pass:** true
- **evidence:** `src/web/src/lib/middleware/auth.ts` L47–52: cache fill returns null unless `status === "active"`; rejects if `!mt || mt.status !== "active" || !mt.workspaceId`. `auth.test.ts` “does not expose a pending token to the cache fill” still 401 + null cache. Done-claims list only CLI/web UI files for WP1–4; no commit message touches auth. HEAD refs: origin/main `31537b21` … HEAD `db64df09` (four product commits; none auth). **Note:** live `git diff origin/main -- auth.ts | wc -l` not re-executed in this gate session (no shell tool); static tree + commit list support unchanged.

### G4 — CLI activate errors map 404/409/422/503 to human hints

- **pass:** true
- **evidence:** `formatActivateFailure` / `activateFailureHint` in `activate.ts` L61–133; wired on `!res.ok` L175–178. `activate.test.ts` unit + activateAndSave path for 404/409/422/503 (+400/401, secret redaction). GREEN: `wp2/green-activate-test.txt` (13 passed). Commit `db64df09`.

### G5 — Doctor fails closed without watched workspace token

- **pass:** true
- **evidence:** `checkRegistration` in `doctor.ts` L94–126: fail + `register --token al_...` per-workspace hint for empty/unusable. Tests in `doctor.test.ts` (empty, no key, deleted/tokenless, runDoctor fail exit). GREEN: `wp3/green-doctor-status-test.txt`. Commit `b9e74ba6`.

### G6 — Connect UI next steps; does not imply whole-PC FS

- **pass:** true
- **evidence:** `ConnectMachineNextSteps` in `connect-machine-steps.tsx` L12–31; locale keys `nextStepsTitle`, `nextStep*`, `agentWorkdirNote` (EN: “not your entire filesystem”). `locale.test.ts` asserts. Command template unchanged `` `${cliCmd()} register --token ${generatedToken}` ``. Commit `0dcc41de`. GREEN: `wp4/locale-test.txt`, web 1790 in `wp4/web-test-summary.txt`.

### G7 — Tests prove WP1–WP4; typecheck/cli green claimed

- **pass:** true
- **evidence (artifacts):**
  - CLI full: `final/cli-test.txt` — 1146 passed | 4 skipped
  - typecheck: `final/typecheck.txt` — 7 successful / 7 total
  - check:project: `final/check-project.txt` — passed
  - Per-WP greens under `wp1/`–`wp4/`
- **evidence (source assertions):** register order + non-fatal me + non-al_; activate status→hint; doctor fail-closed; locale/workdir note.
- **caveat:** this gate session could not re-invoke vitest (no `run_terminal_command` tool). Verdict relies on static test↔code alignment + on-disk run logs (orchestrator reverify included for WP1).

### G8 — No release bump; no full-PC redesign

- **pass:** true
- **evidence:** `@phneakngar/cli` and `@phneakngar/web` still `0.0.1`; no `release: v…` in feature commits; WP-5 deferred; UI/doctor explicitly workdir-only.

---

## Git / scope (inspected)

| Ref | SHA |
| --- | --- |
| `origin/main` | `31537b2116b80a512547fb78c689e599b9e95719` |
| `HEAD` (`main`) | `db64df094ee03182d33702104157cc255c905231` |

Commits `origin/main..HEAD` (from `.git/logs/HEAD`):

1. `791ee742` — fix(cli): activate machine token before /api/me on register  
2. `b9e74ba6` — feat(cli): doctor checks for machine registration gaps  
3. `0dcc41de` — fix(web): clarify connect-machine next steps  
4. `db64df09` — fix(cli): actionable errors for machine token activate  

Plans: `plans/2026-07-15-...md` status EXECUTED; WP1–4 checkboxes [x]; WP-5 deferred; manual prod smoke still [ ] (optional).  
omo plan: `.omo/plans/agent-pc-access-workspace-token.md` todos checked.

---

## remove-ai-slops / programming pass (direct)

| Check | Result |
| --- | --- |
| Excessive/useless tests | **Pass** — WP tests encode real failure modes (stateful pending 401, status→hint, fail-closed doctor) |
| Deletion-only / removal-only tests | **Pass** — none |
| Tautological / implementation-mirroring | **Pass** — mocks server protocol; not reimplementing string map in assert only without exit path |
| Unnecessary production extraction | **Pass** — `formatActivateFailure` is the WP-2 surface; used at real exit site |
| Scope drift | **Pass** — no auth pending accept, no schema, no bump, no full-PC mounts |
| Formal code-review report artifact | **Absent** under `.omo/evidence/**` — gate performed skill/slop pass directly; not treated as product blocker given source proof |

---

## Adversarial probes

| Class | Result |
| --- | --- |
| `misleading_success_output` | Evidence logs consistent (1146 CLI, 13 activate, 7 register, 16 doctor/status, 1790 web). Could not re-run live this session. |
| `stale_state` | Plan “EXECUTED” matches code (activate-first present). Deep-dive “Evidence notes” still describes **old** order in prose (stale docs section only). |
| `dirty_worktree` | Product commits committed on `main`; evidence under `.omo/` (gitignored style). No indication of missing product code. |

---

## checked artifact paths

- `src/cli/commands/register.ts`, `register.test.ts`
- `src/cli/lib/activate.ts`, `activate.test.ts`
- `src/cli/commands/doctor.ts`, `doctor.test.ts`, `status.ts` (hint only)
- `src/web/src/components/connect-machine-steps.tsx`, `src/web/src/lib/locale.ts`, `locale.test.ts`
- `src/web/src/lib/middleware/auth.ts`, `auth.test.ts` (pending)
- `plans/2026-07-15-agent-pc-access-and-workspace-token-deep-dive.md`
- `.omo/plans/agent-pc-access-workspace-token.md`
- `.omo/evidence/agent-pc-access-workspace-token/**` (wp1–4 + final)
- `.omo/ulw-loop/agent-pc-token-exec/{brief.md,goals.json,ledger.jsonl,notepad-path.txt}`
- `.git/refs/heads/main`, `.git/refs/remotes/origin/main`, `.git/logs/HEAD`

## exact evidence gaps

1. No formal `*-code-review.md` / manual QA matrix file (gate substituted direct review).
2. Named criterion paths in goals (`edge-prefix.txt`, `edge-nonfatal-me.txt`, `wp2/errors.txt`) not present as separate files; coverage folded into green suite logs.
3. Live re-run of vitest + `git diff origin/main -- auth.ts` not executed in this gate process (tooling).
4. Manual production smoke still open (human optional).

---

## risks_remaining

1. **Published CLI lag:** npm `@phneakngar/cli@0.0.1` still old register order until explicit bump/publish (documented non-goal).
2. **Production smoke:** not proven end-to-end against live workers (optional).
3. **Hint matching:** activate hints use status + body string includes; server reword without status still has 409 generic fallback.
4. **Deep-dive plan “Evidence notes” section** still documents pre-fix register order — docs drift only.
