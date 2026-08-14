# Standards for Frontend UI/UX Remediation, Phase 1

Full text lives in `agent-os/standards/`.

---

## frontend/design-tokens

@agent-os/standards/frontend/design-tokens.md

The binding standard here. Two token bugs traced to the same root cause: a semantic name
whose value was an alias that inverted between themes.

| token | was | problem | now |
|---|---|---|---|
| `--charcoal` | `var(--ink)` | near-white in dark mode; `bg-charcoal/40` washed the app | deleted |
| `--cream`, `--cream-warm`, `--mist`, `--stone`, `--border-base44` | aliases of paper/ink | same hazard, no remaining usages | deleted |
| dialog overlay | `bg-foreground/50` | inverted in dark mode | `bg-scrim/50` |
| sheet overlay | `bg-black/80` | didn't match Dialog | `bg-scrim/50` |
| filled water tile / done set | `text-white` | thin on the lightened dark-mode `--info` / `--success` | `text-info-foreground`, `text-success-foreground` |

Rule reinforced: **a scrim is not derived from a text color.** `--scrim` is defined
explicitly in both blocks and stays dark in both.

Still outstanding after this phase (Phase 3): the light/dark accent split, and 25 files
carrying raw Tailwind palette colors.

## frontend/mobile-ui

@agent-os/standards/frontend/mobile-ui.md

Amended by this work. The Navigation section previously read "The global Voice Agent FAB
appears on every page **except Home**"; it now records one voice entry point per viewport
and the FAB appearing everywhere, because Home's mic hero was a duplicate of the bottom
nav's centre mic on mobile while being the *only* control on desktop.

Also applied: toasts were `bottom-right`, rendering above the `z-30` bottom nav and
covering navigation for their whole lifetime. Now `top-center` on mobile.

Touch targets are **not** addressed in this phase — `SetRow` steppers (36×28px), rest-timer
chips (~26px) and Body filter chips (~32px) remain under the 44px floor. Phase 4.

## frontend/data-fetching

@agent-os/standards/frontend/data-fetching.md

`setGlasses` follows the standard optimistic shape against `queryKeys.waterToday(today)`:
`onMutate` cancels in-flight queries, snapshots, and writes the new count; `onError`
restores the snapshot; `onSettled` invalidates. The optimistic `mlTotal` mirrors the
backend's own `glasses * 250` so the pre- and post-response values agree.

No new query was introduced for the workout fix — `Body.tsx` already had `workouts` from
`useWorkouts` and simply derives from it.

## frontend/components

@agent-os/standards/frontend/components.md

Existing primitives reused rather than rebuilt: `ContentWithLoading` for Water's cold-load
state, `useIsMobile` for the toast breakpoint, `PulseCard` / `PulseRing` left as they are.

Three components were deleted rather than added: `QuickAddMenu` (unreachable),
`VoiceMicHero` (orphaned by the voice consolidation), and `getBottomNav`'s duplicate array.

## global/critical-rules

@agent-os/standards/global/critical-rules.md

Rule 2 — never remove a working feature — governed the voice consolidation. The desktop
mic FAB was made universal **before** the Home hero was deleted, so voice access is
unchanged in every viewport. The only user-visible loss is a duplicate control.

Rule 4 — don't change API shapes — governed Water. `PUT /api/water-entries` already
accepted an absolute glass count, so the fix is entirely client-side and the MCP server is
unaffected. Zero backend files were touched.
