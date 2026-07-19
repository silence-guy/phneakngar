# Plan 017: Productize approval hold/resume via agent runtime_config

> **Drift check**: `git diff --stat 6a6c7699..HEAD -- src/shared/src/lib/ src/cli/chhlat/agent/claude.ts src/cli/chhlat/tool-gate.ts src/web/src/components/judgment-policy-settings.tsx src/web/src/components/agent-edit-form.tsx`

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: none (parallel with 016)
- **Category**: direction
- **Planned at**: commit `6a6c7699`, 2026-07-19

## Why this matters

Hold/resume exists only behind `CHHLAT_APPROVAL_HOLD=1`. Product users never find it. Expose a durable agent setting (like judgment policy) so high-stakes tools pause until Approvals UI decides.

## Current state

- `approvalHoldEnabledFromEnv` in `src/cli/chhlat/agent/claude.ts`
- Poller registered in `session-runner.ts` via `setApprovalHoldPoller`
- `handleControlRequest` uses env only — no task runtimeConfig
- Judgment pattern: `src/shared/src/lib/judgment-policy.ts` + UI panel + `agent-edit-form` merge into `runtime_config`

## Design

1. New pure module `src/shared/src/lib/approval-hold-policy.ts`:
   - `ApprovalHoldSettings = { enabled: boolean }`
   - `DEFAULT_APPROVAL_HOLD = { enabled: true }` (product default **on** for new/missing config)
   - `readApprovalHoldPolicy(runtimeConfig)` — also accept `approval_hold.enabled`
   - `applyApprovalHoldPolicyToRuntimeConfig(base, settings)`
   - `resolveApprovalHoldEnabled({ runtimeConfig, env })`:
     - env `CHHLAT_APPROVAL_HOLD` / `PHNEAKNGAR_APPROVAL_HOLD` = `0|false|no|off` → force **false**
     - env `1|true|yes|on` → force **true**
     - else → `readApprovalHoldPolicy(runtimeConfig).enabled` (default **true**)

2. CLI: module-level `setApprovalHoldRuntimeConfig(rc)` called when session starts a task (session-runner or wherever task agent is bound). `handleControlRequest` uses `resolveApprovalHoldEnabled`.

3. Web: `ApprovalHoldSettingsPanel` (can live beside judgment in same file or `approval-hold-settings.tsx`), wire agent-edit-form save path. Create-form: default hold on in runtime_config when building.

4. Locale: `agentFormCopy.approvalHold` + hint EN/KM.

5. Docs: INSTALL one-liner that hold is on by default; env forces off.

**No migration** — JSON runtime_config only. **No MIN_CLI_VERSION** required (older CLI ignores key; env still works).

## Scope

**In scope**
- `src/shared/src/lib/approval-hold-policy.ts` (+ test)
- `src/shared/src/index.ts` exports
- `src/cli/chhlat/agent/claude.ts`
- `src/cli/chhlat/session-runner.ts` (set runtime config for hold when wiring poller/task)
- CLI tests for resolve + hold path
- `src/web/src/components/approval-hold-settings.tsx` (+ test) OR extend judgment file
- `src/web/src/components/agent-edit-form.tsx`
- `src/web/src/components/agent-create-form.tsx` (default on)
- `src/web/src/lib/locale.ts` agentForm keys
- `INSTALL.md` short note

**Out of scope**
- Changing approval kinds / decide API
- Desktop-only notify changes
- Default timeout changes (keep 120s)

## Steps

1. Shared pure policy + tests  
2. CLI resolve + session wire + tests  
3. Web panel + forms + locale  
4. INSTALL note  

## Done criteria

- [ ] Hold can enable without env when runtime_config says so
- [ ] Env force-off still works
- [ ] Agent edit shows toggle
- [ ] Shared + CLI + web tests green
- [ ] Default for missing config is enabled=true

## STOP conditions

- control_request path has no access to any task/agent context and cannot be wired without large refactor — report and propose alternative (workspace setting table).

## Maintenance notes

Reviewers: confirm default-on does not surprise headless CI (tests should set env off or mock). Document env override in INSTALL.
