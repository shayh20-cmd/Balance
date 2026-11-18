# Balance — design system (MASTER)

Global source of truth for how Balance looks. Page files in `pages/` override it. Tokens live in
`src/ui/styles.css` under `:root`; components use the tokens, never raw hex.

Built 2026-11-18 with the ui-ux-pro-max skill. Its database proposes trust-blue on dark and handwritten fonts for
"personal finance"; neither fits a warm, Hebrew, family app, so Balance keeps its own identity (option A, chosen
by Shai) and takes the skill's rules: contrast, a type scale, one meaning per color, SVG icons, 44px targets,
reduced motion.

## Character
Warm, calm, personal. A family looking at its month, not a trading desk. One loud element per screen (the
warm "left to spend" card); everything else is quiet white cards on a warm paper background.

## Typography
- **Rubik** (Google Fonts, Hebrew + Latin), weights 400 / 500 / 600 / 700. Fallback: system-ui.
- All amounts use `font-variant-numeric: tabular-nums` so digits line up as they change.

| Token | Size / weight | Use |
|---|---|---|
| `--fs-display` | 44 / 600 | the one big number (left to spend) |
| `--fs-title` | 24 / 600 | screen title (month and year) |
| `--fs-amount` | 26 / 600 | card totals |
| `--fs-amount-sm` | 18 / 600 | row amounts |
| `--fs-body` | 15 / 400 | text |
| `--fs-label` | 13 / 500 | card labels |
| `--fs-caption` | 12 / 400 | sub lines; never smaller |

## Color — one meaning each
| Token | Value | Meaning |
|---|---|---|
| `--bg` | #ece9e2 | warm paper background |
| `--card` | #ffffff | cards |
| `--text` | #141414 | ink |
| `--muted` | #6b675f | secondary text (5.6:1 on white, 4.6:1 on bg) |
| `--line` | #eeebe4 | dividers, empty bar track |
| `--lime` | #d5f35b | brand accent: active tab, focus, highlights |
| `--income` | #1b7d52 | money in (5.1:1 on white, safe for text) |
| `--fixed` | #3a3f4b | fixed expenses (calm slate, 10.5:1) |
| `--variable` | #e0603a | variable spending (coral, from the warm card); bars only, 3.6:1 |
| `--warn` | #a8650a | pace warning (4.6:1) |
| `--bad` | #c0392b | over budget, negative |
| `--dark` | #161616 | the bank card |

Color never carries meaning alone: every colored bar has a label and a number next to it.

## Shape and space
- Radius: cards 24, icon chips 12, bars and pills fully round.
- Spacing scale: 4 · 8 · 12 · 16 · 24. Card padding 18, gap between cards 12.
- Shadow: a hairline (`0 1px 2px rgb(0 0 0 / 4%)`); depth comes from color, not shadow.

## Graphics
- Icons: inline SVG, Lucide style, 1.75 stroke, 20px, `aria-hidden`. No emoji.
- An icon chip (36px, radius 12, tinted with the card's meaning color at 12%) opens each data card.
- Bars: 10px, round. The expenses card adds one split bar: fixed and variable as two segments of the total.

## Home layout (top to bottom)
1. Header: month and year centered, 44px round arrow buttons on both sides, household line under it.
2. Warm card: left to spend (display number, progress bar).
3. Week card (current month only).
4. Income card (green): total, received bar, links to income detail.
5. Expenses card: total, split bar, then a fixed row (slate) and a variable row (coral), each with its own bar
   and a chevron; each row links to its detail.
6. Bank balance (dark) beside the review tile.
7. Recent transactions.

## Interaction and motion
- Every tappable row is at least 44px tall and shows a chevron.
- Press: scale .97. Entrance: cards rise in turn once per app load, bars fill.
- `prefers-reduced-motion`: no entrance, no transitions.
