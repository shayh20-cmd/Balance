# Home Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give Balance the Tokenwise look (variant A, "גרדיאנט חם") through shared tokens, a restyled home screen and a floating tab bar, with CSS-only entrance animations and a count-up on amounts.

**Architecture:** New design tokens in `src/ui/styles.css` restyle every screen at once. `HomeView` gets a bento card layout with the same content and order. `Amount` gains an `animate` prop backed by a small `useCountUp` hook (requestAnimationFrame, no library); entrance and bar fill are CSS keyframes that only run under a `.home.intro` class, which `Home` sets once per app load.

**Tech Stack:** React 18, Vite 8, vite-plugin-pwa, Vitest + Testing Library, `@fontsource/rubik`.

**Spec:** `docs/superpowers/specs/2026-11-18-home-redesign-design.md`

## Global Constraints

- Design only: no new data, screens or content (no "12 ימים נותרו" chip, no avatar).
- No animation library. Everything finishes within ~1.5s.
- Tokens: bg `#ECE9E2`, card `#FFFFFF`, text `#141414`, muted `#8C8981`, line `#EEEBE4`, lime `#D5F35B`, dark `#161616`; card radius 24px; buttons and pills fully rounded; `--good`/`--warn`/`--bad` stay for status.
- Animations: cards rise 14px and fade in, 70ms stagger; count-up ~1.1s ease-out on "נשאר לבזבז", "הוצאתם" and the bank balance; bars fill from 0; press scale 0.97.
- Runs once per app load (not on data refresh, not on returning to the screen). `prefers-reduced-motion: reduce` shows final values at once.
- Rubik self-hosted (hebrew + latin subsets), precached by the PWA so it works offline.
- Hebrew-only RTL; use logical CSS properties.

## Review Focus

- Negative left-to-spend during count-up: the minus sign is present from the first frame, never pops in (test in Task 1).
- Value changes after mount (data refresh) jump to the new value without re-counting (test in Task 1).
- Environment without `matchMedia`/`requestAnimationFrame` (tests, old browsers) shows the final value at once (test in Task 1).
- Returning to Home in the same session does not replay the intro (Task 2, `introPlayed` module flag; checked in the browser).
- Other screens (forms, dialogs, segmented control, toast, FAB) remain legible on the cream background (Task 3, browser check).

---

### Task 1: Count-up in `Amount`

**Files:**
- Create: `src/ui/components/useCountUp.ts`
- Modify: `src/ui/components/Amount.tsx`
- Test: `tests/ui/amount.test.tsx`

**Interfaces:**
- Produces: `useCountUp(target: number, enabled: boolean, durationMs = 1100): number` — magnitude-safe, returns `target` immediately when disabled, reduced motion, or no `matchMedia`/`requestAnimationFrame`; animates only on first mount.
- Produces: `<Amount value className? animate? />` — `animate` defaults to false; sign and `negative` class come from the final value.

- [ ] Test `shows the final value immediately when matchMedia is unavailable` — `render(<Amount value={684000} animate />)` → `getByText('6,840 ₪')`.
- [ ] Test `negative value keeps its minus sign while counting` — stub `matchMedia` (no reduce) and rAF; first frame text starts with `-`.
- [ ] Test `a later value change jumps without counting` — rerender with new value → text equals the new formatted value at once.
- [ ] Implement; count the absolute value, format as `formatShekels(sign * round(abs))` with the minus forced while target < 0.
- [ ] Run `npm test` → PASS; commit.

### Task 2: Restyled `HomeView` and intro flag

**Files:**
- Modify: `src/ui/screens/Home.tsx`, `src/ui/components/ProgressBar.tsx` (accept `className`)
- Test: `tests/ui/home.test.tsx`

**Interfaces:**
- Produces: `HomeView` prop `intro?: boolean` (default false) → adds `intro` class to `.home`; cards carry `rise` with `--i` index.
- Consumes: `Amount animate` from Task 1.

Layout (spec order): header (month big, household · members); CloseReminder; review link; hero gradient card; week card ("הוצאתם" big, "יעד שבועי" opposite, lime bar, "נשארו ... עד שבת", pace warning); pair of dark bank card + review-count card (bank full width when nothing to review); recent rows with a first-letter tile, merchant, source pill · date below, amount; FAB.

- [ ] Update the three layout-bound assertions to the new structure, same content: week → `'הוצאתם'`, `'1,020 ₪'`, `'נשארו 620 ₪ עד שבת'`; bank missing → `'יתרה בבנק'` + `'לא הוזנה'`; bank present → `'14,210 ₪'` + `'עודכן 2.11.2026'`. Add `review count card shows only when there is something to review`.
- [ ] Implement; `Home` keeps a module-level `introPlayed` flag, read in a `useRef` and set in an effect.
- [ ] Run `npm test` → PASS; commit.

### Task 3: Tokens, font, tab bar, PWA colors

**Files:**
- Modify: `src/ui/styles.css`, `src/ui/routes.tsx`, `src/main.tsx`, `index.html`, `vite.config.ts`, `package.json`

- [ ] `npm install @fontsource/rubik`; import hebrew + latin subsets for 400/500/600/700 in `src/main.tsx`.
- [ ] Tokens and component styles per Global Constraints; floating rounded tab bar with a lime underline on the active tab; black floating FAB above it; keyframes `rise` and `fill`, press scale, reduced-motion overrides.
- [ ] `theme-color` and `background_color` → `#ECE9E2`; add `woff2` to the PWA `globPatterns`.
- [ ] `npm run typecheck && npm test && npm run build` → all pass; check Home and other screens in the browser at 375px; commit.
