# Wooz UI tokens

One source of truth: the CSS variables in `app/globals.css` (`:root`, prefix `--wz-`).
`tailwind.config.js` only maps them to classes, and `app/components/ui/tokens.js` mirrors
the motion values for GSAP. New UI (e.g. the Moos chat panel) should use these and not add its own values.

## Feel

Soft, pastel, a bit playful, and clean. Frosted glass floats over the 3D studio so the scene stays visible.
Text is deep green "ink", not black. Use a large Fraunces display serif for titles and Instrument Sans for everything else.
The WOOZ smiley is the brand mark: use it for delight moments such as add-to-bag success and empty states.

## Colour (RGB triplets, so alpha works: `bg-paper/70`, `text-ink/60`)

| Token | Tailwind | Hex | Use |
|---|---|---|---|
| `--wz-ink` | `ink` | #1B3327 | primary text, primary buttons |
| `--wz-ink-soft` | `ink-soft` | #586C61 | secondary text, labels |
| `--wz-green` | `primary` | #4F7960 | brand green, hover, focus ring |
| `--wz-leaf` | `leaf` | #2E9E52 | smiley-logo green: badges, success, accents |
| `--wz-danger` | `danger` | #C95C4C | errors |
| `--wz-paper` | `paper` | #FAF9F6 | base surface |
| `--wz-cloud` | `cloud` | #F1F4F7 | subtle fills |
| `--wz-sky` / `mint` / `blush` / `butter` / `lilac` | same | pastels | illustration, tints, chat bubbles |
| `--wz-line`, `--wz-line-strong` | `border-[color:var(--wz-line)]` | ink at 9% / 18% | hairlines |

## Glass

- `.wz-glass`: large panels (shop panel, menu, modal). It sets the paper background at 74%, `--wz-glass-filter` (blur 28px, saturate 1.6), a white hairline border, `--wz-shadow-lg`, and an inner top highlight.
- `.wz-glass-chip`: small floating controls (Menu, Bag, view switch, hints).
- Tokens: `--wz-glass-bg`, `--wz-glass-bg-strong`, `--wz-glass-border`, `--wz-blur`, `--wz-glass-filter`.

## Type

- Fonts are loaded once in `app/layout.js` with next/font:
  - `--wz-font-display`: Fraunces with SOFT/opsz axes. Tailwind: `font-display`.
  - `--wz-font-sans`: Instrument Sans. This is the body default. Tailwind: `font-sans`.
  - `--wz-font-libre`: Libre Baskerville, the legacy face. Tailwind: `font-libre`.
- Scale:
  - `text-eyebrow`: 11px, uppercase, wide tracking. Or use `.wz-eyebrow`.
  - `text-wz-sm`: 13px.
  - `text-wz-base`: 15px.
  - `text-wz-lg`: 18px.
  - `text-wz-xl`: 24px.
  - `text-wz-display`: fluid, 32 to 46px.
- `.wz-display` gives the Fraunces "soft" styling for headings. Prices use `font-display tabular-nums`.

## Shape and elevation

- Radii:
  - `rounded-wz-xs`: 8px.
  - `rounded-wz-sm`: 12px. Use for inputs, size pills and thumbnails.
  - `rounded-wz-md`: 18px. Use for cards.
  - `rounded-wz-lg`: 24px. Use for the product stage.
  - `rounded-wz-xl`: 32px. Use for panels.
  - `rounded-full`: buttons and chips.
- Shadows:
  - `shadow-wz-sm`
  - `shadow-wz-md`
  - `shadow-wz-lg`
  - `shadow-wz-inner`: the top highlight.
  - `shadow-wz-focus`: the focus ring.

## Motion

| CSS | Tailwind | GSAP (`tokens.js`) |
|---|---|---|
| `--wz-ease-out` cubic-bezier(.22,1,.36,1) | `ease-wz-out` | `EASE.out` = `expo.out` |
| `--wz-ease-in-out` | `ease-wz-in-out` | `EASE.inOut` = `power3.inOut` |
| `--wz-ease-spring` | `ease-wz-spring` | `EASE.spring` = `back.out(1.6)` |
| `--wz-dur-fast` 160ms / `--wz-dur-base` 280ms / `--wz-dur-slow` 560ms | `duration-wz-*` | `DUR.fast/base/slow`, `DUR.panel` 0.9s |

- Panel entrance: slides in with `expo.out` over 0.9s, then its content staggers in (`STAGGER` 0.055s, y 22px to 0).
- Reduced motion:
  - CSS durations collapse to 1ms under `prefers-reduced-motion`.
  - In JS, use `prefersReducedMotion()` or `d(seconds)`.
  - The 3D viewer turns off idle spin and float.

## Interaction primitives (`app/globals.css`, `@layer components`)

- `.wz-btn-primary`: an ink pill that turns green on hover, with press-scale and a focus ring. Set the height and padding yourself.
- `.wz-icon-btn`: a 40px round icon button.
- `.wz-focus`: adds the focus-visible ring to any element.
- `.wz-collapse[data-open]`: smooth height animation (grid rows), used for accordions.
- Animation helpers:
  - `.wz-pop`: badge bump.
  - `.wz-nudge`: the "drag to play" hand.
  - `.wz-skeleton`: shimmer.
  - `.wz-no-scrollbar`
- `.wz-prose`: styling for Shopify description HTML.

## Layers and layout

- z-index:
  - `--wz-z-overlay`: 10. Tailwind: `z-wz-overlay`.
  - `--wz-z-panel`: 40. Tailwind: `z-wz-panel`.
  - `--wz-z-chrome`: 50, for floating Menu and Bag. Tailwind: `z-wz-chrome`.
- `--wz-panel-width` is `clamp(400px, 34vw, 520px)`. `--wz-panel-inset` is 12px, the gap between floating panels and the viewport edge.
- Breakpoint: below `md` (768px), panels become bottom sheets. They are 86dvh tall, have a drag handle, and are dismissed by dragging down.
- While the shop panel is open, `<html data-wz-panel="open">` is set. Use it to move or hide other floating UI.

## Moos chat checklist

- Use a `.wz-glass` container with `rounded-wz-xl` that sits at `--wz-panel-inset` from the viewport edges.
- Use `z-wz-panel`. The chrome layer stays above it.
- Show the speaker name with `.wz-eyebrow` and message text in `text-wz-base`.
- Moos bubbles use `bg-mint`. User bubbles use `bg-ink text-paper`.
- The input is `rounded-full`, shows `shadow-wz-focus` on focus, and sends with `.wz-btn-primary`.
- Animate with GSAP `EASE.out` and `STAGGER`, and respect `prefersReducedMotion()`.
