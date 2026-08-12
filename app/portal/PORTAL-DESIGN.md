# Portal design system

The portal is a product. The rest of the site is a brochure. They used to share one token
layer, and the product lost that argument every time — cream pages, coral buttons, Big
Shoulders at hero sizes, and a global `line-height: 0.95` that made wrapping dashboard
titles collide with themselves.

This document is the contract for keeping them apart.

---

## How it works

Every portal token is **the same name** as its `:root` counterpart, redefined inside
`.portal-scope` at the bottom of `app/globals.css`. The portal's ~21 component files
reference tokens by name, so they re-theme without being edited. There is no `--p-*`
namespace and no component sweep.

That block is **unlayered and last in the file**. `:root` and `[data-theme="dark"]` are also
unlayered, so source order decides and the scoped block wins.

**Do not add a dark counterpart.** The portal is light-only by design, and the mechanism
above is what enforces it: when `next-themes` flips `data-theme` on `<html>`, there is no
dark portal block to match, so the scoped values keep applying. Removing a theme toggle was
a consequence of that decision, not the cause.

## The scope boundary

| Route | Scoped? | Theme |
|---|---|---|
| `/portal` and all `(dash)` routes | yes | product |
| `/portal/sign-in`, `/portal/sign-up` | yes | product |
| **`/portal/onboarding`** | **no** | **agency** |
| everything else | no | agency |

`<PortalScope>` is applied per-route, **not** in `app/portal/layout.tsx`. That layout also
wraps onboarding, which is a sales funnel and deliberately stays on the agency brand —
cream, coral, grain and all. Putting the scope there would silently re-theme it.

Two consequences worth knowing:

- **Grain and chrome have different boundaries.** `MarketingChrome` strips the navbar and
  footer from everything under `/portal` (onboarding included — it has always been a focused
  flow), but strips the *grain* only from the product routes. Gate new texture on
  `isPortalProduct`, not on the `/portal` prefix, or onboarding lands in a third state that
  is neither theme.
- **Clerk's provider spans the whole boundary.** `app/portal/layout.tsx` wraps every
  `/portal/**` route in `<ClerkProvider appearance={portalClerkAppearance}>`, onboarding
  included. That is currently harmless only because onboarding's sole Clerk import is the
  server-side `auth()` helper and it renders no Clerk UI. **If you add Clerk UI to
  onboarding, it will arrive wearing the product palette** — revisit this first.

## What the scope does not reach

- **Inline styles.** They beat everything here. This is why `ui/Card.tsx` and
  `SettingsSection.tsx` needed real edits rather than re-theming for free.
- **Anything React-portals into `<body>`.** In practice that is only Clerk's `<UserButton>`
  popover. It is why `clerkAppearance.ts` carries **literal hex** instead of `var()` — a
  `var()` evaluated at `<body>` resolves against `:root` and comes back cream and coral.
  Keep those hexes in step with the scoped block by hand; each line names the token it
  mirrors.
- **Ancestors.** A scope cannot style `<body>`. `body { background: var(--bg) }` resolves at
  `:root`, so portal routes would show cream in the overscroll gutter. `MarketingChrome`
  emits a small `<style>` for portal routes to repaint the canvas. It is server rendered
  specifically so there is no cream flash before hydration.
- **Clerk's own widget internals.** The scoped heading reset carries
  `:not([class*="cl-"])`. Without it the reset outranks Clerk's own classes and restyles the
  auth card's `<h1>` — which is the same global-heading coupling this system exists to
  remove. Style Clerk through `appearance`, never by reaching into `cl-*`.

A `html:has(.portal-scope)` rule would have been the tidier fix for the canvas and was tried
first. The selector matched in the DOM but never applied as a style — it does not survive
the Tailwind v4 / Lightning CSS pipeline here. Don't re-add it without checking computed
styles in a real browser.

## Palette

| | Token | Value |
|---|---|---|
| Page | `--bg`, `--elev-0` | `#f6f7f9` |
| Card | `--elev-1`, `--elev-2`, `--panel` | `#ffffff` |
| Ink | `--fg` / `--fg-2` / `--fg-3` | `#0d1117` / `#4a5058` / `#767c85` |
| Accent | `--accent`, `--accent-2` | `#2563eb` |
| Positive | `--online`, `--chart-pos` | `#16a34a` |
| Series | `--chart-series-1…4` | `#2563eb` `#7c3aed` `#0891b2` `#64748b` |
| Brand band | `--brand-band` | `#f8ebd5` |

`--accent-2` is an **alias** onto `--accent`, not a second hue. The portal has one accent;
the alias exists so the pre-existing `--accent-2` references keep working.

**Charts fail silently.** `ui/chartTheme.ts` reads `--chart-series-1` through `-4` by name.
Leave any of them undefined in the scope and the charts render agency teal and coral on
white cards with nothing erroring. Same trap applies to `--glass-shadow`, `--leading-*`,
`--tracking-*` and `--text-5xl` — all are consumed somewhere in the portal, and all are
restated in the scope for that reason. **When you add a token to `:root`, ask whether the
portal consumes it.**

## Shape and surface

Cards 8px, controls 6px, chips 999px. Hairline border plus a very shallow neutral shadow.

The `--elev-*` scale still includes a lit top edge for the marketing side; the portal turns
it off with `--elev-highlight: transparent`, which neutralises it in all four `.portal-elev*`
rules without editing any of them. One token to put it back.

Accent marks the **selected** thing and nothing else. Row hover is a flat `--surface` wash
with no marker; the active rail tab is a raised white pill with an accent *icon* and ink
text. `.portal-rail-link` carries a transparent 1px border so the active border doesn't
resize it.

## Type

Inter for UI, **Cabinet Grotesk** (`app/fonts/`, `next/font/local`) for `h1` only, JetBrains
Mono for identifiers. All three are `preload: false` in `app/layout.tsx` — they are
portal-only and preloading is per-document, so preloading would push them onto marketing
pages for visitors who never see the portal. The trade is a brief FOUT on first portal paint.

The scale is **fixed px, no `clamp()`**. Marketing type is viewport-driven because the type
*is* the design; product type should not resize when someone drags a window. 14px base.

## The brand band

`public/jdd-lockup-portal.png`, in a full-bleed cream strip at the top of the rail, linking
to the agency site.

**This is the only agency branding anywhere in the portal, and the only warm surface.** That
is the whole idea: one branded object, everything else product-neutral. The lockup contains
the agency coral `#d95430` — that is deliberate and is the one sanctioned exception to the
cool palette. Don't "fix" it.

**The client's own brand never appears in the portal.** Not their colours, not their logo.
The portal is our product; their site is their brand.

Geometry is a three-way contract — change one, change all three:

| | Band height | Lockup | Rail padding it must mirror |
|---|---|---|---|
| mobile | 68px | 160×48 | `14px 16px` |
| ≥1024px | 80px | 180×54 | `22px 14px` |

`.portal-brand` reaches the rail edges with negative margins that cancel `.portal-rail`'s
padding, so the two must stay in lockstep. The lockup is sized explicitly rather than
`height: auto`, because band height and lockup height are separate decisions.

**Use `jdd-lockup-portal.png`, never `JDD_mark.png`.** The original has a grainy cream ground
baked into the pixels — dropping it on the band produces a visible texture seam, and it is
1,094 KB against 56 KB. The portal asset is the lockup cut out to transparency by per-pixel
ink fitting (`P = a·I + (1−a)·G`, lowest residual wins), verified to composite with no cream
halo on cream, grey, white, saturated blue and near-black. It is also cropped to the *type*
extent rather than the ink bbox, because the divider hairline alone ran 100px taller than the
type and would have spent a quarter of the band on it.

The art is near-black. **Light backgrounds only** — there is no light-on-dark variant of this
asset. (`public/JDD_mark_1.png` is a dark-ground variant of the original, not a cutout.)
