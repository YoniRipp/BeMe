# Plan — Per-Exercise Editing & Catalog Expansion

Status: implemented, PR #255.

## 1. Per-exercise actions in the logger

- [x] Add a `⋯` `DropdownMenu` to each exercise row in `WorkoutDetailView`
- [x] Replace exercise — opens the picker, swaps the name, keeps logged sets/reps/weights
- [x] Move up / Move down — reorder within the workout, disabled at the ends
- [x] Add / Edit note — inline textarea bound to `Exercise.notes`
- [x] Remove exercise — drops only that exercise
- [x] "Add exercise" button, seeded from that movement's last performance via `getPrevious`
- [x] Route every action through the existing `commit()`; add no persistence code
- [x] Demote the full form to a **Settings** item; drop the misleading "Edit workout" button

## 2. Fix the two silent data-loss bugs

- [x] Add `notes` to `exerciseFormSchema`, the `reset()` mapping and `onSubmit`
- [x] Add `completedPerSet` to the same three places
- [x] Regression test that fails on `main`

## 3. Grow the catalog

- [x] `scripts/build-exercise-catalog.js` — free-exercise-db → committed JSON
- [x] Idempotent, dollar-quoted seed migration; `COALESCE` so curated rows win
- [x] Verify against a real Postgres 16: full chain, re-run, apostrophes, curated rows intact

## 4. Make ~960 exercises selectable

- [x] `ExercisePickerSheet` — search, equipment + muscle chips, incremental render, thumbnails
- [x] `equipment` filter on `GET /api/exercises` (+ `routeSchemas`, model, tests)
- [x] Wire into the logger (add/replace) and the full editor (Browse next to each name)

## 5. Starter routines

- [x] Nine built-in routines in `lib/workoutTemplates.ts`
- [x] Verify all 38 exercise names resolve against the seeded catalog

## 6. Image robustness

- [x] `ImagePlaceholder` gains `onError` → falls back to the icon placeholder

## 7. Agent OS conformance pass

Ran after merging `main` (Agent OS v3 landed in #256, after this branch was cut), so this
code had never been checked against the standards.

- [x] `frontend/mobile-ui` — raise every sub-44px control introduced here to the 44px floor
- [x] `frontend/mobile-ui` — add the missing safe-area inset to the picker's scroll container
- [x] `frontend/data-fetching` — move `['exercises']` into `queryKeys`
- [x] Confirm no hardcoded colors, no relative-path imports, `ui/` primitives reused
- [x] Re-run both suites + both typechecks + `sync:agents --check`

## Follow-ups (not in scope here)

- Bundling a subset of exercise images for offline use
- The remaining pre-existing sub-44px controls elsewhere in `WorkoutModal` (e.g. the rest
  timer chips) — deliberately untouched to keep this diff reviewable
