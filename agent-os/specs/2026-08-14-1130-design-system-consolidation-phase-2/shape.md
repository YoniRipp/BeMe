# Design System Consolidation, Phase 2 — Shaping Notes

## The problem

Three UI vocabularies coexisted: `components/ui/` (shadcn), `components/shared/` (a
display layer), and `components/pulse/` (the newest design language). None was retired, so
every screen picked from three, and some picked from all three at once — Body rendered
three different empty states on one page.

The decision taken in Phase 1's shaping was that **Pulse becomes the system**: promote its
primitives into `components/ui/`, keep shadcn's interactive primitives (Dialog, Sheet,
Input, Select) underneath, and retire the `shared/` display layer.

## The finding that made this cheap

`PulseCard` and shadcn's `Card` are the same component.

```
Card       rounded-2xl      border border-border bg-card text-card-foreground shadow-card
PulseCard  rounded-[22px]   border border-border bg-card text-card-foreground shadow-card
```

`--radius` is `0.875rem` (14px) and the config defines `2xl: calc(var(--radius) + 8px)` —
so `rounded-2xl` **is** 22px. `PulseCard` was `Card` with the radius written as a magic
number. Folding the 28 usages into `Card` is a provably zero-visual-change edit, and it
removes the duplicate that was driving most of the "which card do I use?" confusion.

The same arithmetic retired three more magic numbers: `rounded-[14px]` is `rounded-lg`
(exactly `--radius`), and `rounded-[10px]` is `rounded-sm` (`--radius - 4px`). Eleven of
the sixteen arbitrary radii were already on the scale, just not spelled that way.

## Decisions

- **Rename on promotion.** `PulseX` names carried a design-language prefix that means
  nothing once it *is* the system. They move to `components/ui/` as `Page`, `PageHeader`,
  `SectionHeader`, `ProgressRing`, `QuickTile`, `BackButton`, `AudioWave`.
- **`ProgressRing` takes a required `label`.** The rings are the largest number on Home and
  Water and were completely invisible to a screen reader. Making the prop required means
  the compiler refuses a new unlabelled ring — this is the a11y fix that is cheapest to do
  while the file is being rewritten anyway, rather than deferring it to Phase 4 and
  touching the file twice.
- **One `EmptyState`, and its action is a real button.** `EmptyState` had zero call sites
  and a dual API (`action` *or* `actionLabel`+`onAction`); `EmptyStateCard` had three and
  was a `div` with `role="button"`, hand-rolled Enter/Space handling, and a separate
  "Get started" affordance that only *looked* like the button. The merged component renders
  a real `<button>` at the 44px floor. Presence of an `icon` selects the first-run weight
  (inviting) versus the no-match weight (quiet), which absorbed two hand-rolled variants.
- **Size-only type tokens.** `text-eyebrow` / `text-caption` replace `text-[11px]` /
  `text-[10px]` (64 uses). They deliberately carry no bundled `lineHeight` or `fontWeight`:
  every call site already sets `font-bold`/`font-semibold` and often a `tracking-*`, and a
  bundled weight would win or lose against those by stylesheet order rather than intent.

## Deliberately not done

**`rounded-xl` is smaller than `rounded-lg`.** The config extends `sm`/`md`/`lg`/`2xl`/`3xl`
from `--radius` but never defines `xl`, so `xl` falls through to Tailwind's default
`0.75rem` (12px) — below `lg` (14px) and identical to `md` (12px). The scale reads:

| token | value |
|---|---|
| `sm` | 10px |
| `md` | 12px |
| **`xl`** | **12px** ← out of order, duplicate of `md` |
| `lg` | 14px |
| `2xl` | 22px |
| `3xl` | 30px |

Defining `xl: calc(var(--radius) + 4px)` (18px) would fix the ordering and give the four
remaining arbitrary radii (18px ×1, 20px ×1, 24px ×2) a home. But `rounded-xl` has 45 call
sites, and 12px → 18px is a visible change on all of them — on a `h-8 w-8` icon button an
18px radius is nearly a circle. That is a design call, not a cleanup, so it is left for the
owner to decide rather than folded into a refactor billed as visually neutral.

## Standards Applied

- `frontend/design-tokens` — radii resolved to the `--radius` scale; the two dominant
  arbitrary font sizes named; no new colors
- `frontend/components` — one primitive per job; prefer an existing `ui/` primitive over a
  new styled div; shadcn's interactive primitives kept as the base layer
- `frontend/mobile-ui` — `EmptyState`'s action and `BackButton` both sit on the 44px floor
  (`BackButton` was `h-10 w-10`)
- `global/critical-rules` — the `PulseCard` fold is provably identical markup; every other
  move is a rename verified by the compiler and the suite
