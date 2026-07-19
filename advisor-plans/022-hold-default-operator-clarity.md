# Plan 022: Hold-default operator clarity (no behavior surprise)

> **Executor instructions**: Follow step by step. Verify each step. Touch only in-scope files. Do **not** flip the product default to off unless the plan explicitly says so (it does not).
>
> **Drift check**: `git diff --stat 4b268440..HEAD -- src/shared/src/lib/approval-hold-policy.ts src/web/src/components/approval-hold-settings.tsx src/web/src/components/agent-edit-form.tsx src/cli/chhlat INSTALL.md docs/parity-status.md`

## Status

- **Status**: DONE (see README for 024 operator pending)
- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none (lands on top of A–E hold work in `4b268440`)
- **Category**: direction / docs / UX polish
- **Planned at**: commit `4b268440`, 2026-07-19

## Why this matters

Hold defaults to **on** when `runtime_config.approvalHold` is missing. That is product intent, but operators of pre-existing agents can think “I never set this” means “old deny+pointer behavior.” Closing the residual means **making the default visible and overridable without changing the default**.

## Current state (excerpt)

`src/shared/src/lib/approval-hold-policy.ts`:

```ts
export const DEFAULT_APPROVAL_HOLD = { enabled: true };
// missing hold key → DEFAULT_APPROVAL_HOLD
export function resolveApprovalHoldEnabled({ runtimeConfig, env }) {
  // env force on/off first, else readApprovalHoldPolicy(runtimeConfig).enabled
}
```

Agent Runtime tab already has `ApprovalHoldSettingsPanel` (toggle + hint mentioning `CHHLAT_APPROVAL_HOLD=0`).

INSTALL already has a short “Approval hold” section after web-brain.

## Decision (locked)

| Question | Answer |
| --- | --- |
| Change default to off? | **No** |
| Add migration / backfill every agent? | **No** (JSON default is enough) |
| What to ship | Visibility + doctor/docs + optional “effective hold” note |

## Commands

| Purpose | Command | Expected |
| --- | --- | --- |
| Shared tests | `pnpm --filter @phneakngar/shared exec vitest run src/lib/approval-hold-policy.test.ts` | pass |
| Web hold UI tests | `pnpm --filter @phneakngar/web exec vitest run src/components/approval-hold-settings.test.ts` | pass |
| CLI doctor if touched | `pnpm --filter @phneakngar/cli exec vitest run` (filter doctor) | pass |
| Gates | `pnpm check:project && pnpm --filter @phneakngar/shared typecheck && pnpm --filter @phneakngar/cli typecheck` | exit 0 |

## Scope

**In scope**
- `src/web/src/lib/locale.ts` — strengthen `approvalHoldHint` EN/KM: state that **missing config = on**; list both env and toggle overrides
- `src/web/src/components/approval-hold-settings.tsx` — optional one-line “Effective: on/off” is **not** required; prefer locale-only unless UI needs a badge when `enabled` is default
- `INSTALL.md` — short “Existing agents” bullet under Approval hold
- `docs/parity-status.md` — one line that default-on is intentional; env/toggle override
- Optional S: `src/cli/commands/doctor.ts` + test — doctor row “Approval hold: on (default|runtime|env)” using `resolveApprovalHoldEnabled` / reading a sample agent is **out** if doctor has no agent context; prefer process-level: report env override only (`env forces off|on|unset → runtime default on`)

**Out of scope**
- Changing `DEFAULT_APPROVAL_HOLD.enabled` to `false`
- Workspace-global hold setting table / migration
- Changing hold timeout defaults
- Desktop notify changes

## Git workflow

- Commit style: `docs:` or `feat(cli):` / `fix(web):` as appropriate  
  Example: `docs: clarify approval-hold default-on for existing agents`
- Do not push unless operator asks

## Steps

### Step 1: Locale / UI copy

Update `approvalHoldHint` (and title if needed) so operators see:

- Default is **on** even when never configured  
- Toggle saves explicit `runtime_config.approvalHold.enabled`  
- Machine: `CHHLAT_APPROVAL_HOLD=0` forces off  

**Verify**: `locale.test.ts` still passes if it asserts keys exist; add assertion that hint mentions default or `CHHLAT_APPROVAL_HOLD` if a locale test pattern exists.

### Step 2: INSTALL + parity

INSTALL “Approval hold” section:

```markdown
Existing agents without `approvalHold` in runtime_config still **hold** (product default).
Turn off per agent in Runtime settings, or set `CHHLAT_APPROVAL_HOLD=0` on the machine.
```

parity-status row already mentions default on — ensure wording matches and does not say “opt-in env only.”

**Verify**: `rg -n "approvalHold|CHHLAT_APPROVAL_HOLD|default" INSTALL.md docs/parity-status.md` shows consistent story.

### Step 3 (optional): Doctor env visibility

If `phneakngar doctor` already prints env-ish rows, add a pure helper + check:

- env unset → `Approval hold: runtime default (on unless agent disables)`  
- env 0 → `forced off`  
- env 1 → `forced on`  

No network. Unit test the pure string builder.

**Verify**: doctor unit test green.

## Test plan

- Keep existing `approval-hold-policy.test.ts` cases for default-on and env force  
- Add one test only if new pure doctor helper is introduced  
- No e2e required  

## Done criteria

- [ ] Docs/UI clearly state missing config ⇒ hold **on**
- [ ] Default constant still `enabled: true`
- [ ] Override paths documented (toggle + env)
- [ ] Targeted tests + `pnpm check:project` pass
- [ ] No behavior change for resolve logic unless doctor-only

## STOP conditions

- Product owner asks to flip default to off → STOP; that is a different plan with CLI/min-version implications  
- Doctor has no clean place for the row without large refactor → skip Step 3 and finish docs/UI only  

## Maintenance notes

Reviewers: do not “fix” default-on by changing `DEFAULT_APPROVAL_HOLD` without an explicit product decision. Future workspace-level policy can supersede agent-level later.
