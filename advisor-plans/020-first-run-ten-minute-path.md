# Plan 020: First-run “personal company in 10 minutes” path polish

> **Drift check**: `git diff --stat 6a6c7699..HEAD -- src/web/src/app/(app)/w/[slug]/home/ src/web/src/components/connect-machine-steps.tsx src/web/src/lib/locale.ts INSTALL.md`

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: LOW
- **Depends on**: 016 optional (link to Activity in help copy only)
- **Category**: direction
- **Planned at**: commit `6a6c7699`, 2026-07-19

## Why this matters

Activation fails when empty states and connect-machine steps do not name the next action (create agent, wire web, open approvals, wait for team PC). Polish copy + one checklist on home for owners with agents but no recent activity.

## Current state

- `home-empty-state.ts` matrix for zero agents
- `connect-machine-steps.tsx` has next steps list
- Home page large; welcome lifecycle notes partially shipped

## Design (minimal, DESIGN.md)

1. Extend home empty presentation copy (locale) with clearer next actions:
   - Owner no computer: connect machine first
   - Owner has computer: create first agent / studio
   - Member waiting: wait for owner PC / optional connect
2. After agents exist + computer online, optional “First mission” card (dismissible via localStorage key `phneakngar.firstMission.v1.{workspaceId}`):
   - Checklist: agent online · send test email or DM · open Approvals · (optional) wire web-brain · open Activity
   - Links to existing routes only
3. INSTALL: “10-minute path” section linking dashboard + CLI steps
4. Tests: pure resolve for first-mission visibility helper

## Scope

**In scope**
- `src/web/src/app/(app)/w/[slug]/home/home-empty-state.ts` (+ test if new helpers)
- `src/web/src/app/(app)/w/[slug]/home/first-mission.ts` (create pure helpers)
- `src/web/src/app/(app)/w/[slug]/home/first-mission.test.ts`
- `src/web/src/app/(app)/w/[slug]/home/page.tsx` — render first mission card when helper says so
- Locale keys for first mission + tightened empty copy
- `connect-machine-steps.tsx` — only if next-step copy needs web-brain/doctor line
- `INSTALL.md` 10-minute path

**Out of scope**
- Redesign home pet / marketing
- New APIs
- Auto-create agents

## Done criteria

- [ ] Empty states still match matrix tests
- [ ] First mission pure helper tested (show/hide/dismiss key)
- [ ] INSTALL 10-minute section
- [ ] No chatbot bubble UI

## STOP conditions

- Home page structure too different to insert card without large rewrite — put card in help page instead and note in report
