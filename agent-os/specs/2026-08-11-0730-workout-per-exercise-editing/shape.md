# Per-Exercise Editing & Exercise Catalog Expansion — Shaping Notes

## Scope

Two user-reported problems, both confirmed in the code before changing anything.

1. **Editing a workout was all-or-nothing.** `WorkoutDetailView` already logged sets inline
   (tap a weight or reps value, debounced auto-save), but it could only adjust sets of
   exercises that *already existed*. Adding, removing, replacing or reordering an exercise
   meant leaving for the full react-hook-form editor and saving the entire workout.
2. **Too few cable and barbell movements.** Counted from the seed migrations: 117 exercises
   total, only 14 cable and 27 barbell.

## Decisions

- **Reuse `commit()`, add no persistence code.** Every new action (replace, reorder, note,
  remove, add) routes through the existing debounced commit path, inheriting its optimistic
  update and unmount-flush. No API change, no new mutation.
- **Demote the full form rather than delete it.** It still owns title, type, date and
  duration, so it becomes a small **Settings** item instead of a full-width "Edit workout"
  button. That button was the actual UX bug: it implied everything below was read-only when
  those fields were live all along.
- **Ship the catalog as generated, committed JSON** (`scripts/build-exercise-catalog.js` →
  `migrations/data/exercises-catalog.json`) rather than fetching at migrate time, so
  migrations stay deterministic and work offline.
- **Curated rows win on conflict.** The seed uses `COALESCE` to fill NULLs only, so the 117
  hand-mapped images and categories survive.
- **Hot-link images to jsDelivr, don't bundle.** ~1,750 JPGs would add roughly 96MB to the
  repo. `ImagePlaceholder` gained an `onError` fallback so a dead URL degrades to the icon
  placeholder instead of a broken image.
- **A picker sheet, not an autocomplete.** A text input with a dropdown was already weak at
  117 entries and unusable at 962. Search + equipment/muscle filter chips + thumbnails.

## Source data

[`yuhonas/free-exercise-db`](https://github.com/yuhonas/free-exercise-db) — Unlicense
(public domain, no attribution obligation). This repo already hot-links it from
`1775400000000_update-exercise-images-free-exercisedb.js`.

| equipment | before | after |
|---|---|---|
| barbell | 27 | 197 |
| cable | 14 | 91 |
| dumbbell | 28 | 147 |
| machine | 18 | 80 |
| bodyweight | 26 | 209 |
| kettlebell | 0 | 52 |
| **total** | **117** | **962** |

## Constraints

- `workout.exercises` persists as a JSONB blob, so new per-exercise fields round-trip
  without a schema change — but the full editor must be taught to carry them or it silently
  drops them on save (see below).
- Migration must be idempotent and apostrophe-safe (`Farmer's Walk`, `Landmine 180's`).

## Bugs found while tracing the save path

Both are pre-existing data loss in the full editor, not caused by this work:

- **Per-exercise `notes`** — absent from `exerciseFormSchema`, the `reset()` mapping and
  `onSubmit`. Without this fix the new "Add note" action would have been a data-loss trap.
- **Per-set completion (`completedPerSet`)** — same gap, so opening the editor after logging
  wiped set-by-set progress.

## Standards Applied

- `frontend/mobile-ui` — 44px touch targets, safe-area inset on the bottom sheet
- `frontend/components` — reuse `ui/sheet`, `ui/input`, `ImagePlaceholder`; no new styled div
- `frontend/design-tokens` — semantic tokens only, no hardcoded colors
- `frontend/data-fetching` — centralized query key, explicit `staleTime`
- `backend/models` — `exercises` is a shared catalog table with no `user_id`
- `global/critical-rules` — the logger is live; per-exercise actions must not break set logging
