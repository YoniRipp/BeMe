# Reference Implementations Studied

## For the custom-exercise endpoint

- `backend/src/routes/exercises.ts` — the catalog's existing read routes; the new POST joins them
- `backend/src/models/exercise.ts` — `upsert()` already does `ON CONFLICT (name)` for the admin
  path, which is where the create-or-return-existing behaviour comes from
- `backend/src/routes/workout.ts` + `controllers/workout.ts` + `services/workout.ts` — the
  four-layer shape a new domain endpoint copies
- `backend/src/schemas/routeSchemas.ts` — where `exerciseListQuerySchema` lives, so the create
  schema sits beside it

## For the picker UI

- `frontend/src/components/body/ExercisePickerSheet.tsx` — the sheet gaining the create flow;
  its empty state was already the right place to offer it
- `frontend/src/hooks/useExercises.ts` — catalog query, name indexes, filter/rank logic
- `frontend/src/hooks/useWorkouts.ts` — the mutation + `setQueryData` pattern the new
  `createExercise` follows

## For the trainer removal

- `frontend/src/components/layout/Base44Layout.tsx` — the two nav arrays and `hasTrainerAccess`
- `frontend/src/routes.tsx` — `TrainerRouteGuard` and the two trainer routes
- `backend/src/middleware/auth.ts` — `requireTrainer`, `resolveTrainerClientUserId`
- `backend/src/services/voiceExecutor.ts` — the six `*_client_*` action cases and the roster
  resolution helpers they share
- `backend/src/services/subscription.ts` — the trainer→clients subscription cascade
- `backend/src/models/adminStats.ts` — the trainer CRM metrics in the admin overview

## Prior specs leaned on

- `agent-os/specs/2026-08-14-1300-palette-a11y-and-logging-speed/plan.md` — the palette
  consolidation this colour pass continues (and the source of the "one identity across
  themes" rule)
- `agent-os/specs/2026-08-11-0730-workout-per-exercise-editing/shape.md` — why the picker is a
  sheet rather than an autocomplete
</content>
