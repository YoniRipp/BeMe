# Standards for Per-Exercise Editing & Catalog Expansion

The following standards apply to this work. Full text lives in `agent-os/standards/`.

---

## frontend/mobile-ui

@agent-os/standards/frontend/mobile-ui.md

The binding constraint here. Every control this work introduces is used one-handed, mid-set,
often with chalk or gloves — so the 44px floor is a real requirement, not a checkbox.

Audited and corrected in this spec's implementation:

| control | was | now |
|---|---|---|
| `⋯` exercise menu trigger | `h-9 w-9` (36px) | `h-11 w-11` (44px) |
| equipment / muscle filter chips | `py-1.5 text-xs` (~28px) | `min-h-11` |
| picker close button | `h-9 w-9` (36px) | `h-11 w-11` |
| "Show more" / "Clear filters" | `py-2.5` / `py-2` (~32-36px) | `min-h-11` |
| "Add set" (logger + full editor) | `py-2 text-xs` (~32px) | `min-h-11` |

**`.tap-target` is not a hit-area utility.** It is `active:scale-[0.98]` — press feedback
only. Applying it does not satisfy the 44px rule; set an explicit `min-h-11` / `h-11`.

**`.pulse-bottom-sheet` does not carry a safe-area inset.** It sets radius and colors only.
A bottom-anchored sheet needs its own bottom padding or the last row sits under the home
indicator. `.pb-safe` alone is wrong here — it resolves to `0px` on non-notched devices and
would *remove* the base padding, so compose both:
`pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))]`.

---

## frontend/components

@agent-os/standards/frontend/components.md

`ExercisePickerSheet` composes `ui/sheet`, `ui/input` and the shared `ImagePlaceholder`
rather than hand-rolling a sheet. Filter chips are a local `FilterChip` subcomponent, not
repeated class strings. Imports use the `@/` alias throughout.

---

## frontend/design-tokens

@agent-os/standards/frontend/design-tokens.md

No hex or raw HSL in any new component — semantic tokens only (`border-primary`, `bg-card`,
`text-muted-foreground`). Rows use `rounded-2xl` + `shadow-card` per the card standard.

---

## frontend/data-fetching

@agent-os/standards/frontend/data-fetching.md

`useExercises` had an inlined `queryKey: ['exercises']` (pre-existing, from `5b7aa7b`).
Now that this hook backs a ~960-row picker it was moved to `queryKeys.exercises` in
`lib/queryClient.ts`. `staleTime` was already explicit at 10 minutes — the catalog is
reference data that changes only on migration.

---

## backend/models

@agent-os/standards/backend/models.md

> Shared catalog tables have no owner — `exercises` and `foods` are global reference data
> with no `user_id` column.

The new `equipment` filter on `GET /api/exercises` therefore filters on `equipment` alone
with no ownership predicate. Parameterized (`$n`); the search path uses `escapeLike`.

---

## global/critical-rules

@agent-os/standards/global/critical-rules.md

The set logger is live and in daily use. Per-exercise actions reuse the existing `commit()`
debounce rather than introducing a second write path, so there is no window where the two
disagree. Regression tests cover exercise-level isolation — remove/reorder/note must affect
only the target exercise.

---

## global/testing

@agent-os/standards/global/testing.md

Tests co-locate (`ExercisePickerSheet.test.tsx` beside the component). The notes +
`completedPerSet` round-trip test fails on `main`, which is what makes it a regression test
rather than a restatement of the implementation.
