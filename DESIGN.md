## Design Context

### Users
Power users and tasteful hackers who want Your Personal Company with a minimalist, collaborative approach. They value control over their infrastructure, appreciate good tooling, and have strong aesthetic sensibilities. They use ភ្នាក់ងារ in focused work sessions — managing agents, reviewing task output, and iterating on instructions.

### Brand Personality
**Precise, calm, and utilitarian.** ភ្នាក់ងារ feels like a well-crafted developer tool — not cold and corporate, not flashy and consumer. It earns trust through restraint and clarity. Every element has a reason. Warmth lives in the writing and the micro-interactions, never in the color palette.

3-word personality: **Sharp. Quiet. Purposeful.**

Emotional goals: confidence, calm focus, quiet delight in small details.

### Aesthetic Direction
**Visual tone**: Vercel's Geist design system — monochrome surfaces, near-neutral grays, color reserved for state. Pure white / pure black canvases, hairline alpha borders, flat matte surfaces separated by borders instead of tint or glow. Light and airy in light mode, focused and deep in dark mode.

**References**: Geist (`https://vercel.com/design.md` + `https://vercel.com/design.dark.md`), Vercel dashboard and docs (monochrome, border-separated, typography-driven).

**Anti-references**:
- Warm/cream/editorial palettes (tinted neutrals, hue 60–80° oklch, "vintage" textures) — this product is deliberately not that.
- Generic SaaS dashboards (blue buttons, card grids, cookie-cutter layouts).
- AI chatbot UIs (ChatGPT-style centered chat with big rounded bubbles and gradients).
- Glass-morphism, backdrop blur, ambient gradients, glows — surfaces are matte and opaque.

**Theme**: Both light and dark as first-class citizens. Geist light (#fff canvas / #171717 ink) and Geist dark (#000 canvas / #ededed ink). Never tinted neutrals.

### Design Principles

1. **Every pixel earns its place** — No decorative filler. If an element doesn't help the user accomplish their goal, remove it. Whitespace is a feature, not wasted space.

2. **Borders over tint** — Hierarchy comes from hairline borders and text-color rank, not from surface color variety. When in doubt, add a border or drop a level of text contrast — never add a tint.

3. **Progressive disclosure** — Start simple, reveal depth through interaction. The interface should feel approachable on first use and powerful on the hundredth.

4. **Motion with meaning** — Animate state changes to orient the user, not to impress. A well-timed 200ms transition beats a flashy 2-second animation.

5. **Respect the craft** — This is a tool for people who appreciate good tools. Match the quality they expect from their best CLI utilities — fast, predictable, and delightful in the details.

### Progressive disclosure

Never show all options at once. Complexity exists but stays one interaction away.

- **Hover to preview** — hovering a linked page shows a preview without navigating. Tooltips appear contextually, not eagerly.
- **Click to expand** — sidebar tree nodes, dropdown menus, and kanban column options are collapsed by default. Expanded state is driven by user action, not by default.
- **Scrolling reveals depth** — additional features and settings appear as the user scrolls or explores. The first screen is always clean.

## Color System — Geist

Monochrome surfaces, near-neutral grays, color reserved strictly for state. The full system is tokenized in `src/web/src/app/globals.css` (`:root` = Geist light, `.dark` = Geist dark). Never hardcode color literals in components — use the tokens.

### Two backgrounds, that's all

- `--background`: `#ffffff` light / `#000000` dark — the canvas.
- `--secondary` / `--muted` / `--accent`: `#fafafa` / `#f2f2f2` light, `#1a1a1a` dark — subtle separation, never a general fill.

### Text ranks (gray scale)

- Primary text: `--foreground` — `#171717` / `#ededed`.
- Secondary text: `--muted-foreground` — `#4d4d4d` / `#a0a0a0`.
- Borders and dividers: `--border` — gray-alpha that layers over any surface: `rgba(0,0,0,0.08)` light / `rgba(255,255,255,0.145)` dark.

### Color is state, never decoration

- **Blue** (`--ring`: `#006bff` light / `#47a8ff` dark) — links, focus rings, primary interactive state only.
- **Red** (`--destructive`: `#ea001d` / `#e2162a`) — destructive actions and errors only.
- **Green** (`--status-online`), plus amber/teal/purple scales — status indicators and charts only.
- If a screen needs "more color", fix the hierarchy with borders and text rank instead.

### Focus

Two-layer ring on every interactive element via the shared `focus-geist` utility:

```css
box-shadow: 0 0 0 2px var(--background), 0 0 0 4px var(--ring);
```

### Shadows (quiet)

Tonal borders do the hierarchy work. Shadows stay quiet:

- `--e1`: `0 2px 2px rgba(0,0,0,0.04)` — cards at rest (light).
- `--e2`: `0 1px 1px rgba(0,0,0,0.02), 0 4px 8px -4px rgba(0,0,0,0.04), 0 16px 24px -8px rgba(0,0,0,0.06)` — popovers, menus, modals.

### Matte everything

No glass-morphism, no `backdrop-blur` on chrome, no ambient gradients, no glows, no grain/paper textures. Surfaces are opaque and flat; borders separate them. The app shell is `bg-card` + alpha ring, never translucent.

## Typography — Geist

- **Geist Sans** for all UI text and headings (`--font-geist-sans`). Base size 14px / 20px line.
- **Geist Mono** for code, data, timestamps, terminal-style surfaces (`--font-geist-mono`).
- **Noto Sans Khmer** for Khmer content, kept as the first face in `--font-khmer` and in the `html[lang="km"]` fallback rules — Khmer clusters must never collapse.
- Headings are 600-weight with tracking that tightens as size grows: `--tracking-heading: -0.02em` for 14–20px, `--tracking-display: -0.04em` for 24px and up.
- Tight display tracking must not be applied to Khmer text (it stacks subscript clusters) — the `html[lang="km"]` guards in globals.css enforce normal letter-spacing there.

## Geometry — Geist

- 4px spacing base; 40px-tall default controls (32px small, 48px large), buttons padded `0 10px`.
- One radius family per view: **6px** (`rounded-md`) on buttons/inputs/everyday surfaces, **12px** (`rounded-lg`) on menus/popovers/modals, **16px** (`rounded-xl`) on full-screen surfaces like the app shell main pane.
- Menu items render as 32px rows.
- Motion: 150ms state changes / 200ms popovers / 300ms overlays, `cubic-bezier(0.175, 0.885, 0.32, 1.1)` where a slight overshoot helps; 0ms when motion adds nothing. Honor `prefers-reduced-motion`.

## Visual Harmony

Every pixel should reduce mental load, not add it. Whitespace, typography, and hierarchy aren't cosmetic — they're how brains process information.

- The UI should fade into the background. If a user notices the tool instead of their content, something is wrong.
- Aim for visual calm: Japanese minimalism, Bauhaus clarity. No decoration that doesn't serve comprehension.
- If a feature makes the interface more complicated without making it more powerful, cut it.

## Loading to Loaded Stability

The transition from loading to loaded must feel like a *reveal*, not a *rearrangement*. The user's eye should never lose its place.

### Core rule
The loading skeleton and the loaded content must occupy the **same dimensions, position, and layout flow**. Nothing should jump, shift, or reflow when data arrives.

### Guidelines

- **Reserve exact space** — Skeleton placeholders must match the height, width, and margin of the real content they replace. A skeleton card that is 20px shorter than the loaded card causes a visible pop.
- **Anchor scroll position** — If content loads above the viewport (e.g. prepending items), compensate scroll offset so the user's visible content stays pinned.
- **Fade, don't swap** — Use a short crossfade (150–200ms, ease-out) to transition from skeleton to content. Avoid hard cuts where a gray block snaps to text in a single frame.
- **Match structure, not just size** — Skeleton shapes should echo the content layout (e.g. a line for a title, a shorter line for metadata, a block for an avatar). Generic identical bars feel lazy and make the transition more jarring, not less.
- **No Cumulative Layout Shift (CLS)** — Treat any visible layout shift during load as a bug. Images must have explicit dimensions or aspect-ratio containers. Dynamic lists should use fixed-height rows or virtualized containers.
- **Empty states hold the frame** — When a section loads but has zero items, the empty state placeholder must fill the same region the skeleton occupied. Don't collapse the container.
- **Stagger gracefully** — If multiple sections load independently, each section transitions on its own timeline. One section loading should never cause another to reflow.
- **Avoid spinners as primary indicators** — Prefer inline skeletons over centered spinners. Spinners displace content and create a jarring before/after. Use spinners only for actions (button presses, form submissions) where there is no content to skeleton.
- **Neutral shimmer** — Skeleton shimmer runs on neutral gray (`--shimmer` / `--shimmer-peak` tokens). Never tinted.
