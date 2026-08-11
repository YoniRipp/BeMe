# References for Per-Exercise Editing & Catalog Expansion

## Code being extended

### Workout detail / set logger
- **Location:** `frontend/src/components/body/WorkoutModal.tsx`
- **Relevance:** Holds both `WorkoutDetailView` (the logger) and the full react-hook-form
  editor. The `⋯` menu, "Add exercise" and the note textarea are added to the logger.
- **Key pattern:** `commit()` — debounced, optimistic, flushed on unmount. Every new
  mutating action goes through it. Do not add a second write path.

### Exercise data hook
- **Location:** `frontend/src/hooks/useExercises.ts`
- **Relevance:** Fetches the whole catalog once and indexes it by normalized name.
  `filterExercises` powers the picker; `EQUIPMENT_FILTERS` / `MUSCLE_FILTERS` and their
  label maps are exported for the chips.
- **Key pattern:** one query, client-side filtering. At ~960 rows this is cheaper than a
  request per keystroke, and it keeps the picker responsive offline.

### Exercise model
- **Location:** `backend/src/models/exercise.ts`
- **Relevance:** Gained the `equipment` filter. Shared catalog table — no `user_id`.
- **Key patterns:** `RETURNING` const, `rowToExercise` mapper, optional trailing `client`
  param, `getPool('exercises')`, `escapeLike` for the search path.

## New surface

| File | Purpose |
|---|---|
| `frontend/src/components/body/ExercisePickerSheet.tsx` | Bottom-sheet picker: search, equipment + muscle chips, incremental render, thumbnails |
| `frontend/src/lib/workoutTemplates.ts` | Nine built-in starter routines (PPL, Upper/Lower, Full Body, 5×5, cable circuit, Core) |
| `backend/scripts/build-exercise-catalog.js` | Generator: free-exercise-db → committed JSON. Re-run to refresh |
| `backend/migrations/data/exercises-catalog.json` | Generated seed data, committed |
| `backend/migrations/1776100000000_seed-full-exercise-catalog.js` | Idempotent, dollar-quoted, `COALESCE`-only seed |

## Patterns to follow

- **Bottom sheet** — `components/ui/sheet.tsx` with `side="bottom"` and the
  `.pulse-bottom-sheet` class. See existing usage in the voice and food-entry sheets.
  Remember the safe-area inset; the class does not supply it.
- **Image fallback** — `ImagePlaceholder` renders a tinted lucide icon when `imageUrl` is
  undefined *or* now when the image fails to load. There are no placeholder image files;
  never point an `<img src>` at one.
- **Migration seeding** — `backend/migrations/` (`node-pg-migrate`). The prior
  `1775400000000_update-exercise-images-free-exercisedb.js` is the precedent for using this
  data source.

## Verification performed

Against a real PostgreSQL 16, not mocks:

- Full migration chain (`node-pg-migrate up`) completes with this migration in place
- Idempotent — re-running changes no row counts
- Apostrophe-safe — dollar-quoting handles `Farmer's Walk`, `Child's Pose`, `Landmine 180's`
- Curated rows preserved — `Bench Press`, `Cable Fly`, `Deadlift`, `Lat Pulldown` keep their
  original hand-mapped images
- Equipment filter returns cable-only rows; combined muscle+equipment filtering works
- Sampled seeded image URLs return HTTP 200
- All 38 exercise names used by the starter routines resolve against the seeded catalog
- 201 frontend + 214 backend tests pass; both packages typecheck
