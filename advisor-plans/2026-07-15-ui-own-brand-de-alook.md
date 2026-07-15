# UI Own-Brand Differentiation — Stop Looking Like Alook

**Status:** planning only — **do not implement until owner says start**  
**Survey commit (original audit):** `59fc4a2d`  
**Compared against:** live [alook.ai](https://alook.ai/)  
**Decisions:** **locked** (owner accepted recommended defaults, 2026-07-15)  
**Note:** Canonical tracked copy lives under `advisor-plans/` because root `plans/` is gitignored (local-only per AGENTS.md).

---

## Locked product decisions

| Fork | Decision |
| --- | --- |
| Accent | **Deep teal** — primary CTAs, focus rings, online/active states |
| Hero | **Product canvas / desk mock** built from real product primitives (not typewriter, not abstract film) |
| Pet | **Settings-only experimental**, default **off**; never on marketing; rename away from `cloud-code-monster*` |
| Scope | **Full program**: marketing first (mandatory), then product shell chrome |
| Slogan | **Rewrite** — drop Alook-parallel “Your Personal Company / ក្រុមហ៊ុនផ្ទាល់ខ្លួន” as the hero identity; reposition around always-on agents + email identity (Khmer-first) |
| Fonts (marketing) | **Drop Caveat + VT323** after marketing rewrite; Khmer via Noto Sans Khmer |
| Aesthetic | **“Studio Colleague”** — calm agent studio, not 1980s CRT / typewriter nostalgia |

### Locked slogan direction (copy targets)

| Surface | Avoid (Alook twin) | Use instead |
| --- | --- | --- |
| Hero H1 | “ដំណើរការក្រុមហ៊ុនផ្ទាល់ខ្លួន” / “Run Your Personal Company” | **ភ្នាក់ងារ AI បើកដំណើរការជានិច្ច** (or tighter variant) |
| Subline | “only need yourself and Alook” twin | Agents get **roles + email + always-on runtime** on your machine |
| Footer / meta short | “ក្រុមហ៊ុនផ្ទាល់ខ្លួនរបស់អ្នក” as primary brand line | **ភ្នាក់ងារ — ភ្នាក់ងារ AI របស់អ្នក** / always-on team framing |
| English residual | “Your Personal Company” in DESIGN/docs | Remove or relegate to historical note only |

### Locked accent tokens (starting point)

Executor must put exact values into `DESIGN.md` + `globals.css` before screen work:

| Token role | Light (target) | Dark (target) |
| --- | --- | --- |
| Background | warm off-white `oklch(0.98 0.01 85)` | warm near-black `oklch(0.17 0.01 50)` |
| Foreground / ink | `oklch(0.22 0.02 50)` | `oklch(0.93 0.01 85)` |
| Primary / accent | deep teal `oklch(0.48 0.09 200)` | brighter teal `oklch(0.72 0.08 200)` |
| Primary foreground | near-white on teal | dark ink on teal |
| Status online | teal-adjacent green, not Alook phosphor yellow | same family |
| Marketing CRT/phosphor | **delete** after consumers gone | — |

Avoid Alook cream lock (`#ede7dd` / yellow phosphor hue ~80 as hero identity).

---

## features / show case

After implementation, a visitor who knows Alook should **not** recognize the product in a 5-second side-by-side glance.

### What “done” looks like

1. **Landing is a different product story**
   - New hero: product canvas/desk mock + one primary CTA + secondary install
   - No 3D typewriter, no CRT phosphor panels, no Roman I–V ASCII feature deck
   - New section order (see IA below)
   - Voice is **ភ្នាក់ងារ / Khmer-first studio tool**

2. **Visual system is owned**
   - Deep teal accent, new type stack, matte studio surfaces
   - Brand mark, OG, social banners, desktop icons, PWA theme colors share one system

3. **Product shell feels different enough**
   - Same capabilities; chrome, density, accent, empty states diverge from Alook’s icon-rail + frosted card + pixel pet brand

4. **No clone fingerprints in copy/demo**
   - No `jarvis@…` as marketing face; no Alook clipboard twin; no “Your Personal Company” residue in DESIGN/docs

5. **Regression-safe**
   - Khmer locale, auth, workspace, packages keep working; verification gates pass

### Non-goals

- Renaming npm packages / monorepo scope (already `phneakngar`)
- D1 schema, workers, chhlat protocol changes
- Legal counsel on upstream license (owner decision outside this UI plan)
- Implementing in this planning session

---

## designs overview

### 1. Diagnosis — what still reads as Alook

String rebrand is largely done. **Visual and structural DNA is still Alook.**

| Fingerprint | Alook | This repo | Severity |
| --- | --- | --- | --- |
| Hero centerpiece | 3D typewriter + `jarvis@alook.ai` paper | `TypewriterVisual` + `jarvis@…` | **Critical** |
| Hero slogan formula | “Run Your Personal Company” | Khmer twin in `hero-section.tsx` | High |
| Install ritual | Onboard.md clipboard strip | Same pattern in hero | High |
| Section IA | Use Cases → I–V → BYOA → CRT self-host → architecture | Same in `home-page.tsx` | **Critical** |
| Feature deck | Roman I–V + identical ASCII | `feature-showcase.tsx` | **Critical** |
| Use-case set | Same six scenarios | `use-cases-section.tsx` + scripts | High |
| Landing aesthetic | Cream paper, CRT, phosphor, scanlines | `.landing` + `.crt-panel-*` in `globals.css` | **Critical** |
| Type stack | Caveat + CRT display | Caveat + VT323 in `layout.tsx` | High |
| Mascot | Distinctive floating pet | `CloudCodeMonsterPet` | High |
| Product chrome | Icon rail + floating card | `WorkspaceShell` + `AppSidebar` | Medium |
| Social / OG | Typewriter illustration | `og/route.tsx` + `assets/social-preview/*` | High |

**Conclusion:** text-only rebrand cannot make this “yours.”

### 2. Already owned (keep)

- Name `ភ្នាក់ងារ`, packages `@phneakngar/*`
- Brand mark v2 geometry in `logo-mark.svg` (refine color to teal system)
- Khmer UI label modules
- DESIGN.md principles: restraint, progressive disclosure, warm precision — **rewrite aesthetic references only**

### 3. Aesthetic thesis — Studio Colleague (locked)

> A calm Khmer-first **agent studio**: paper desk energy without Macintosh cosplay, live signal without phosphor CRT, collaboration without org-chart ASCII.

| Axis | Leave | Move to |
| --- | --- | --- |
| Mood | CRT nostalgia, typewriter fetish | Quiet studio / command desk / always-on colleague |
| Temperature | Cream + yellow phosphor | Warm ink + **deep teal** accent |
| Surfaces | CRT bezels, scanlines | Soft matte panels, hairline borders; grain only if subtle on hero |
| Display type | VT323 + Caveat | Noto Sans Khmer primary; one Latin sans for EN blog only |
| Hero object | 3D typewriter | **Live agent canvas / multi-agent desk mock** |
| Features | Roman I–V + ASCII | 3–4 capability pillars with product UI embeds |
| Mascot | Cloud Code Monster on marketing | **Off marketing**; settings-only in product |
| Motion | Long GSAP spectacle | 150–250ms opacity/transform; no CRT flicker |

### 4. Target landing IA (locked)

```text
TODAY (Alook twin)
  MarketingNav
  Hero (typewriter)
  UseCases (6)
  FeatureShowcase (I–V ASCII)
  ByoaSection (CRT)
  QuickstartSection (CRT full-bleed)
  ArchitectureOverview
  MarketingFooter
  CloudCodeMonsterPet

TARGET (owned)
  MarketingNav (new chrome)
  Hero (product canvas mock + primary CTA + secondary install)
  Proof strip (3 outcomes — original Khmer-market scenarios, not Alook’s six)
  How it works (3 steps: agents · email · always-on runtime)
  Capability pillars (3–4 product embeds — no ASCII roman deck)
  Runtime / BYOA (clean cards, no CRT)
  Trust / self-host (short, light)
  Footer
  (no marketing pet)
```

### 5. Product shell direction (Phase 3)

| Element | Current | Owned |
| --- | --- | --- |
| Sidebar | 56px icon rail | Keep rail pattern but **teal active states**; optional hover mini-labels |
| Main frame | `rounded-xl` frosted floating card | Keep usability; retune radius/shadow/accent so screenshots diverge |
| Chat bubbles | Soft cluster radii | User bubble → **teal primary** |
| Pet | Cloud Code Monster available | Default **off**; rename `cloud-code-monster*` → `workspace-pet*` |
| Empty states | Generic | Khmer-first + brand mark + one action |

### 6. Side-by-side acceptance checklist (manual)

At 1280px vs alook.ai:

- [ ] Hero object is not a typewriter
- [ ] No CRT scanline full-bleed section
- [ ] No Roman I–V + matching ASCII blocks
- [ ] No identical six use-case titles (even translated)
- [ ] Wordmark font is not Caveat-like script
- [ ] Accent is obviously deep teal, not yellow-phosphor-on-cream
- [ ] No floating pixel monster on marketing
- [ ] First 3 sections tell a different story order
- [ ] Hero/meta slogan is not “Personal Company” twin

### 7. Risks

| Risk | Mitigation |
| --- | --- |
| Huge PR | Ship phases 0→1→2→3→4 as separate commits/PRs |
| Khmer glyph collapse | Never use Latin display faces on Khmer H1–H3; keep `html[lang="km"]` font rules |
| OG still typewriter | Replace OG in same PR that deletes typewriter |
| Pet rename blast | Feature-flag / default off first; rename with tests |
| Color-only fake win | §6 checklist mandatory before “done” |

---

## new deps

**None.** Keep GSAP if already present (reduce usage). Keep existing shadcn / Base UI. Do not add animation or UI kits.

---

## TODOS

### Phase 0 — Design contract (docs only)

- [ ] **0.1 Update `DESIGN.md` to Studio Colleague contract**
  - Files: `DESIGN.md`
  - Lock accent table, type stack, motion rules
  - Banlist: typewriter hero, VT323, Caveat wordmark, CRT panels/scanlines, ASCII I–V deck, Cloud Code Monster as brand mascot, “Your Personal Company” as primary slogan
  - Document target landing IA and locked slogan direction

- [ ] **0.2 Attach clone-tell inventory to PR description when implementing**
  - Marketing: `src/web/src/components/home/**`, `typewriter-visual.tsx`, `page.tsx`, `og/route.tsx`
  - Tokens/fonts: `globals.css`, `layout.tsx`
  - Pet: `home-pet/**`, settings pet tab
  - Assets: `assets/social-preview/**`, `manifest.json`
  - Shell: `workspace-shell.tsx`, `app-sidebar.tsx`, chat primitives

### Phase 1 — Tokens + brand primitives

- [ ] **1.1 Retune CSS variables (deep teal system)**
  - Files: `src/web/src/app/globals.css`
  - Apply locked token table
  - Keep warm neutrals; remove Alook cream/phosphor as identity
  - Leave `.landing` / CRT blocks until Phase 2 deletes consumers, then remove

- [ ] **1.2 Brand mark + chrome colors**
  - Files: `src/web/public/logo-mark.svg`, `logo-mark-dark.svg`, `brand-mark.tsx`, `manifest.json`, `layout.tsx` `themeColor`
  - Align mark with teal system; keep agent+signal geometry if still distinct

- [ ] **1.3 Metadata defaults**
  - Files: `layout.tsx`, `page.tsx`, `manifest.json`
  - Apply locked slogan direction (Khmer-first)
  - Twitter `site`: keep only if handle is owned; else remove

### Phase 2 — Marketing rebuild (mandatory identity break)

- [ ] **2.1 Rebuild `HomePage` composition to target IA**
  - Files: `home-page.tsx` + new/rewritten sections under `components/home/`
  - Remove marketing `CloudCodeMonsterPet` mount

- [ ] **2.2 Replace hero with product canvas/desk mock**
  - Files: `hero-section.tsx` (rewrite); stop importing `TypewriterVisual`
  - Primary CTA + secondary install (restyle `/onboard.md` as calm studio card — not Alook clipboard twin)
  - Demo personas: Khmer names (e.g. វិចិត្រ / ដារ៉ា), **not** `jarvis@`

- [ ] **2.3 Retire Alook feature deck**
  - Files: `feature-showcase.tsx` → new 3–4 pillars
  - Delete matching ASCII art / Roman I–V order

- [ ] **2.4 Replace use-cases strip**
  - Files: `use-cases-section.tsx`, `demo-pad/use-case-scripts.ts`
  - Max **3 original** Khmer-market scenarios or static product shots
  - Forbidden: Alook’s six titles even if translated 1:1

- [ ] **2.5 Restyle BYOA + self-host**
  - Files: `byoa-section.tsx`, `quickstart-section.tsx`
  - No `crt-panel-*`, phosphor glow, CRT full-bleed

- [ ] **2.6 Architecture / proof**
  - Files: `architecture-overview.tsx`, `demo-window.tsx`, demo-pad
  - Restyle chrome to new system

- [ ] **2.7 Nav + footer**
  - Files: `marketing-nav.tsx`, `marketing-footer.tsx`, `public-layout.tsx`
  - No Caveat brand styling; locked slogan language

- [ ] **2.8 Delete dead marketing systems**
  - Delete/retire: `typewriter-visual.tsx`, unused CRT CSS, marketing-only CRT tokens
  - Rewrite: `app/og/route.tsx` without typewriter
  - Regenerate: `assets/social-preview/*`
  - Drop `Caveat` + `VT323` from `layout.tsx` once unused
  - Grep gate (must be 0 in user-facing marketing paths): `TypewriterVisual`, `crt-panel`, `landing-phosphor`, `font-crt`, marketing `CloudCodeMonsterPet`

### Phase 3 — Product shell differentiation

- [ ] **3.1 Workspace chrome**
  - Files: `workspace-shell.tsx`, `gradient-background.tsx`, `mobile-top-bar.tsx`

- [ ] **3.2 Sidebar / logo**
  - Files: `app-sidebar.tsx`, `sidebar/*`, `nav-user.tsx`, `logo.tsx`
  - Teal active / focus states

- [ ] **3.3 Chat / cards**
  - Files: `chat-primitives/message-bubble.tsx`, agent chat, event cards
  - User bubble → brand teal primary

- [ ] **3.4 Pet de-identification**
  - Files: `home-pet/**`, settings `pet-tab.tsx`, `home-pet-settings`
  - Default **off**; rename `cloud-code-monster*` → `workspace-pet*` + update tests
  - Marketing never loads pet

- [ ] **3.5 Auth surface**
  - Files: `sign-in/sign-in-client.tsx`, `(auth)/layout.tsx`
  - Match new tokens; keep Khmer labels

### Phase 4 — Assets + verification

- [ ] **4.1 Regenerate assets**
  - Files: `assets/*`, gallery screenshots if Alook-like, desktop `src-tauri/icons/*` if mark changes

- [ ] **4.2 Docs screenshots / README**
  - Files: `README.md`, `README.km.md`, install docs with old landing shots

- [ ] **4.3 Verification gates (required)**
  - `pnpm check:project`
  - `pnpm typecheck`
  - `pnpm test` (or document scoped failures precisely)
  - Manual §6 side-by-side checklist
  - Grep banlist clean on product UI paths: `alook`, `TypewriterVisual`, `crt-panel`, `VT323`, `Caveat`, `landing-phosphor`

- [ ] **4.4 Check off this plan’s boxes as phases land**

### test cases

#### Automated

- [ ] **TC-A1** `pnpm --filter @phneakngar/web test`
- [ ] **TC-A2** `*-labels.test.ts` / `public-metadata.test.ts` still Khmer-correct
- [ ] **TC-A3** Pet rename tests updated
- [ ] **TC-A4** `pnpm typecheck` (no imports of deleted modules)
- [ ] **TC-A5** `pnpm check:project`

#### Visual / product

- [ ] **TC-V1** Marketing 375 / 768 / 1280 — no overflow; Khmer H1 legible
- [ ] **TC-V2** §6 checklist vs alook.ai
- [ ] **TC-V3** Sign-in light/dark on new tokens
- [ ] **TC-V4** Workspace shell: teal on primary/active
- [ ] **TC-V5** `/og` without typewriter
- [ ] **TC-V6** Templates + blog share new nav/footer
- [ ] **TC-V7** `prefers-reduced-motion` does not break layout

#### Must-not-break

- [ ] **TC-R1** Auth OTP flow
- [ ] **TC-R2** Workspace agents / canvas load
- [ ] **TC-R3** `email-domain` helpers / tests
- [ ] **TC-R4** `/onboard.md` still served if install depends on it

---

## Execution order

| Order | Phase | Effort | Identity impact |
| --- | --- | --- | --- |
| 1 | Phase 0 DESIGN.md | S | Contract |
| 2 | Phase 1 tokens + mark | M | Immediate tint shift |
| 3 | Phase 2 marketing rebuild | L | **Removes “this is Alook”** |
| 4 | Phase 3 product shell | M–L | App screenshots diverge |
| 5 | Phase 4 assets + verify | M | Public face complete |

**Minimum viable “not Alook”:** Phase 0 + 1 + 2 + 4.  
**Full own-brand (locked scope):** all phases including 3.

---

## Implementation notes for executors

1. **Do not** only recolor — Phase 2 structure changes are mandatory.
2. Prefer **deleting** Alook-signature code over hiding with CSS.
3. Match repo conventions: label modules, `thin-scrollbar` on overflow surfaces.
4. Preserve `html[lang="km"]` font rules when editing `globals.css`.
5. After Phase 2, paste ripgrep banlist results into the PR.
6. Reconcile (do not blindly re-run) older plans:
   - `plans/own-brand-identity.md` — copy/metadata leftovers (local-only)
   - `plans/remove-phneakngar-branding.md` — completed string rename (historical)

---

## Appendix A — Clone-tell hotspots

```text
src/web/src/components/home/home-page.tsx
src/web/src/components/home/hero-section.tsx
src/web/src/components/typewriter-visual.tsx
src/web/src/components/home/feature-showcase.tsx
src/web/src/components/home/use-cases-section.tsx
src/web/src/components/home/byoa-section.tsx
src/web/src/components/home/quickstart-section.tsx
src/web/src/components/home/architecture-overview.tsx
src/web/src/components/home/marketing-nav.tsx
src/web/src/components/home/marketing-footer.tsx
src/web/src/components/home-pet/cloud-code-monster-pet*.tsx
src/web/src/app/globals.css
src/web/src/app/layout.tsx
src/web/src/app/og/route.tsx
src/web/src/components/workspace-shell.tsx
src/web/src/components/app-sidebar.tsx
assets/social-preview/*
DESIGN.md
```

## Appendix B — Evidence snapshot

- Alook live: typewriter + jarvis birthday email, Onboard.md clipboard, six use-cases, Features I–V ASCII, BYOA, CRT self-host, architecture demos.
- Local mirrors those sections/assets with Khmer copy and `ភ្នាក់ងារ` naming.
- Brand mark already partially differentiated (agent + signal, 2026-07).

---

*Planning document only. Implementation starts only when the owner explicitly requests it.*
