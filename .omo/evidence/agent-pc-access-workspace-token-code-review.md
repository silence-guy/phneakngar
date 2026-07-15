# Code quality review — agent-pc-access-workspace-token

**Role:** lazycodex-code-reviewer (read-only)  
**Date:** 2026-07-15  
**Range:** `origin/main` (`31537b21`) .. `HEAD` (`db64df09`)  
**Commits:**
- `791ee742` fix(cli): activate machine token before /api/me on register
- `b9e74ba6` feat(cli): doctor checks for machine registration gaps
- `0dcc41de` fix(web): clarify connect-machine next steps
- `db64df09` fix(cli): actionable errors for machine token activate

**codeQualityStatus:** CLEAR  
**recommendation:** APPROVE  
**blockers:** none

---

## Skill-perspective check

| Skill | Loaded / consulted | Diff violates? |
| --- | --- | --- |
| `remove-ai-slops` | Yes — full SKILL.md criteria applied (deletion-only/tautological tests, implementation-mirroring, needless production parsing/normalization) | **No CRITICAL/HIGH.** Tests pin observable CLI behavior (order, exit, config save, hints, redaction). Production parsing is boundary-only (HTTP activate error body → user-facing message + secret scrub). |
| `programming` | Yes — SKILL.md shared axioms + TS relevance (parse-at-boundary, no brittle prompt tests, no untyped escape hatches in production paths touched) | **No CRITICAL/HIGH.** No `any` in changed production paths; status mapping is HTTP-status driven; no needless abstraction layers. |

Live `pnpm`/shell re-run was **unavailable** in this reviewer session (no shell tool). Test verdict is grounded in: (1) source↔test alignment by direct file read, (2) on-disk executor evidence under `.omo/evidence/agent-pc-access-workspace-token/`.

---

## Checklist results

### 1. Register order (activate before `/api/me`) — PASS

`src/cli/commands/register.ts`:
- Lines 42–45: `activateAndSave` first (after `al_` validation).
- Lines 47–55: optional post-activate `/api/me` for display email only.
- Comment correctly inverted (no longer “verify first so we don't activate”).

`register.test.ts`:
- Stateful pending mock: pre-activate `/api/me` → 401; activate still runs; `activateIdx < meIdx` when me present.
- Config save asserts watched workspace token after activate.

### 2. Non-fatal post-activate `/api/me` — PASS

- `register.ts` try/catch swallows me failures (mirror `login.ts` non-fatal me pattern).
- Test `still succeeds when post-activate GET /api/me fails` (500): no exit 1, config saved, no “Registered as …” log.

Note: `login.ts` still calls `/api/me` **before** activate using a **session** token — different auth type; not a parity bug.

### 3. `formatActivateFailure` completeness + secret redaction — PASS

`src/cli/lib/activate.ts`:
- Maps 404, 422, 409 (another user / already used / generic), 503, 400, 401 + body-text fallbacks.
- `sanitizeActivateBody`: `al_[A-Za-z0-9_-]{8,}` → `al_[redacted]`, body capped at 200 chars.
- Wired on `!res.ok` before `fatalExit`.
- Tests cover status→hint paths + secret non-leak + non-JSON body.

### 4. Doctor fail-closed — PASS

`checkRegistration` (`doctor.ts` ~94–126):
- Empty list / missing key / only deleted or tokenless → `status: "fail"` + `register --token al_...` hint.
- Token present + not deleted → pass.
- `runDoctor` aggregates fail → exitCode 1.
- `checkAgentWorkdirScope` is INFO only (workdir, not whole PC).

### 5. UI command + no false full-PC claim — PASS

`connect-machine-steps.tsx` L70: `` `${cliCmd()} register --token ${generatedToken}` `` unchanged.  
Ordered next steps + `agentWorkdirNote` EN/KM: sandboxed agent workspace, not entire filesystem.  
`locale.test.ts` asserts note + absence of full-PC/root wording in terminal description.

### 6. Test quality — PASS (with minor LOWs)

| Area | Assessment |
| --- | --- |
| Pending register path | **Real behavioral test** (stateful 401-until-activate) — not tautological |
| Post-me non-fatal | Asserts save + absence of Registered line |
| Activate status mapping | Per-status hint content, not constant mirroring alone |
| Redaction | Asserts full secret absent + redacted marker |
| Doctor | Empty / unusable / pass cases; runDoctor fail-closed |
| Locale | Slightly string-oriented (acceptable for copy WP); also negative assertion against full-PC claims |

No deletion-only “prove we removed X” tests. No production-side data extraction beyond HTTP error display.

### 7. Scope / security — PASS

| Non-goal | Evidence |
| --- | --- |
| No pending in `withAuth` | `auth.ts` still requires `status === "active"`; pending cache fill returns null → 401; **no commit in range touches auth** |
| No schema/migrations | No `schema.ts` / migration files in claims or changed paths |
| No version bump | Plan/claims `no_version_bump`; commits are fix/feat only, not `release:` |
| No full-PC FS | Doctor INFO + UI note; no FS mount changes |

### 8. Regression risks — PASS / residual notes

| Risk | Assessment |
| --- | --- |
| `login.ts` parity | Shared `activateAndSave`; login session-me-before-activate remains correct |
| Multi-workspace | Register still upserts by `workspace_id` from activate response; preserves other watched entries (test covers update path) |
| SIGHUP | Still in `activateAndSave` after save; register test still expects SIGHUP when pid alive |
| Config write before activate | Still blocked: save only after successful activate + workspaces fetch |
| npx published CLI | Still pre-fix until explicit bump/publish (documented out of scope) |

---

## Findings by severity

### CRITICAL

_(none)_

### HIGH

_(none)_

### MEDIUM

_(none)_

### LOW

1. **Soft 401 assertion in activate unit test**  
   - File: `src/cli/lib/activate.test.ts` ~L87–91  
   - Issue: `expect(msg).toMatch(/token|server/i)` is almost always true for these messages; less sharp than 404/409 cases.  
   - Fix (optional): assert the actionable hint substrings (`fresh token`, `init --server`, etc.).

2. **Redaction floor length**  
   - File: `src/cli/lib/activate.ts` L35 (`AL_TOKEN_RE` requires ≥8 body chars after `al_`)  
   - Issue: pathological short `al_*` fragments in error bodies would not redact. Real machine tokens are long; production risk negligible.  
   - Fix (optional): lower min length or redact any `al_` prefix run.

3. **Registration “usable” = token present and not deleted**  
   - File: `src/cli/commands/doctor.ts` L97  
   - Issue: local status `inactive`/`revoked` (if ever stored) would still pass. Matches prior `status.ts` pattern; not a new security hole (server still enforces active).  
   - Fix (optional): require `status === "active"` if local statuses expand.

4. **INFO workdir check ignores profile param**  
   - File: `src/cli/commands/doctor.ts` L129–132 (`void profile`)  
   - Issue: intentional stable path under shared `configDir()`; fine given current profile model.  
   - Fix: none required unless profiles get separate workspaces roots.

---

## Tests observed (evidence, not live re-run)

| Suite | Artifact / claim | Result |
| --- | --- | --- |
| `commands/register.test.ts` | `wp1/green-register-test.txt`, orchestrator-reverify | 7 passed |
| `lib/activate.test.ts` | `wp2/green-activate-test.txt` | 13 passed |
| `commands/doctor.test.ts` + `status.test.ts` | `wp3/green-doctor-status-test.txt` | 16 passed |
| Full CLI | `final/cli-test.txt` | 1146 passed \| 4 skipped |
| Typecheck | `final/typecheck.txt` | turbo typecheck green |
| check:project | `final/check-project.txt` | pass |
| Web locale | `wp4/locale-test.txt` | green (claimed) |

**Reviewer note:** Could not execute the assignment’s vitest command in-session (no shell). Source and evidence files are consistent; recommend human/CI still re-run the four files if desired.

---

## Security notes

- Pending machine Bearer remains **non-API-capable** (`withAuth` active-only).
- Activate is unauthenticated `withEnv` POST by design; CLI does not weaken that model.
- Activate failure console path redacts `al_*` and truncates body.
- Config/token written only after successful activate (and workspace list).
- UI does not claim whole-disk agent access.
- Residual: published npm CLI lag until bump (ops, not a code defect in these commits).

---

## Verdict

**APPROVE** — fixes match the root-cause design (activate-first CLI-only), security non-goals held, tests are behavior-oriented with TDD red→green evidence, scope is controlled (no auth pending accept, no schema, no bump). Residual items are LOW polish only.

```json
{
  "codeQualityStatus": "CLEAR",
  "recommendation": "APPROVE",
  "reportPath": ".omo/evidence/agent-pc-access-workspace-token-code-review.md",
  "blockers": []
}
```
