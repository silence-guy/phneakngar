# Plan 018: Web-brain 0.0.3 release showcase (docs + honesty)

> **Drift check**: `git diff --stat 6a6c7699..HEAD -- INSTALL.md README.md docs/parity-status.md src/cli/commands/web.ts`

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: docs / direction
- **Planned at**: commit `6a6c7699`, 2026-07-19

## Why this matters

Web-brain (search/fetch/extract/crawl/diff + MCP wire) is the clearest new capability since 0.0.2 but under-documented for release storytelling. Package the showcase without claiming full research-agent or wigolo parity.

## Current state

- INSTALL already mentions web search + wire-mcp lightly
- CLI: `phneakngar web search|fetch|extract|crawl|diff|wire-mcp`
- Doctor includes web-brain check
- AGPL boundary: `@phneakngar/web-brain` separate package

## Scope

**In scope**
- `INSTALL.md` — expand web-brain showcase (search, fetch, extract, crawl, diff, wire-mcp, doctor)
- `README.md` — Core capabilities bullet + honesty (lean local web tools; not full wigolo)
- `docs/parity-status.md` — one row for web-brain lean toolkit shipped
- Optional: `src/web/src/lib/locale.ts` already has MCP hint — only touch if missing crawl/diff mention

**Out of scope**
- New web-brain features, Playwright, ML
- Version bump (`pnpm bump`) — operator does release separately

## Steps

1. INSTALL section “Live web tools (web-brain)” with copy-paste commands  
2. README capability + non-claim  
3. parity-status row  

## Done criteria

- [ ] Operator can follow INSTALL to wire MCP and run mock search
- [ ] No “full Helio/OpenClaw parity” upgrade
- [ ] AGPL / lean disk noted

## STOP conditions

- web CLI commands renamed — update to live `--help` names
