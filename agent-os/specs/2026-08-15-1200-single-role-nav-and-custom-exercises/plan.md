# Plan — Single Role, New Bottom Nav, Custom Exercises

Status: implemented.

## Task 1 — Save spec documentation

- [x] `shape.md` — scope and decisions
- [x] `standards.md` — which standards apply and the points carried into the work
- [x] `references.md` — the code studied before changing anything
- [x] `plan.md` — this file

## Task 2 — Retire the trainer role (backend)

- [x] Deleted `routes/trainer.ts`, `controllers/trainer.ts`, `services/trainer.ts`,
      `models/trainerClient.ts`, `models/trainerAnalytics.ts` and their three test files
- [x] `requireTrainer` and `resolveTrainerClientUserId` removed from `middleware/auth.ts`;
      `resolveEffectiveUserId` (the admin `?userId=` override) untouched
- [x] `services/subscription.ts` no longer cascades a trainer's plan to their clients;
      `grantTrainerSubscription` / `revokeTrainerSubscription` are gone from the user model
- [x] Role unions narrowed to `'admin' | 'user'` in `models/user.ts`, `routes/users.ts` and
      the `db/schema.ts` check constraint
- [x] Pro statuses collapsed to `['pro']` in `services/aiQuota.ts` and the user model's
      remaining-calls calculation
- [x] Six `*_client_*` voice actions removed across `voice/tools.js` (28 → 22 declarations),
      `services/voice.ts` (prompt), `services/voice/actionBuilders.ts` and `voiceExecutor.ts`,
      along with the roster-resolution helpers they shared
- [x] Trainer CRM metrics dropped from `models/adminStats.ts` (overview, subscription
      breakdown segment, `getTrainerGrowth`) and the service's fallback shape
- [x] `types/domain.ts` — `TrainerClient` / `TrainerInvitation` removed
- [x] Migration `1776300000000_remove-trainer-role.js`: roles normalised, `trainer` /
      `trainer_pro` subscription statuses migrated to `pro`, constraint tightened.
      `trainer_clients` / `trainer_invitations` are deliberately **not** dropped.

## Task 3 — Retire the trainer role (frontend)

- [x] Deleted `pages/Trainer.tsx`, `pages/TrainerClientView.tsx`, `components/trainer/`,
      `hooks/useTrainer.ts`, `core/api/trainer.ts` and the Trainer page test
- [x] `routes.tsx` — `TrainerRouteGuard` and both trainer routes removed
- [x] Six trainer query keys removed from `lib/queryClient.ts`
- [x] `schemas/voice.ts` and `lib/voiceActionExecutor.ts` — client action schemas and the
      "handled server-side" stub handlers removed
- [x] `VoiceAgentPanel` — trainer-page prompt copy and the client-cache invalidation gone
- [x] Admin: role filter and role pickers lose `trainer`; the Trainees / Trainers /
      Trainer Seats overview cards and the Trainer CRM growth chart go with the metrics
      that no longer exist; `PendingInvitations` off the Settings page
- [x] `UserRole` is `'admin' | 'user'`; `SubscriptionStatus` loses `trainer` / `trainer_pro`

## Task 4 — Bottom navigation

- [x] One `BOTTOM_NAV` constant: **Home · Workouts · Food · Profile**. No role branching,
      no `hasTrainerAccess`.
- [x] Profile → `/settings`; Food → `/energy` (label change only, no route rename)
- [x] Goals left the bar, kept its sidebar entry and route
- [x] Sidebar renamed Journal → Food and Settings → Profile so the two navs agree
- [x] `Base44Layout.test.tsx` rewritten: four tabs in order, Profile/Food destinations,
      Goals in the sidebar but not the bar, no Clients entry for anyone including admins

## Task 5 — Custom exercises

- [x] Migration `1776400000000_add-exercise-is-custom.js` + the same column in
      `db/schema.ts` (both bootstrap paths)
- [x] `models/exercise.ts` — `findByName` (case-insensitive, served by the existing
      `lower(name)` index) and `createCustom` (global row, `is_custom`, equipment written to
      `category` too for older readers); `isCustom` added to the list projection
- [x] `services/exercise.ts` + `controllers/exercise.ts` — new four-layer path; existing
      name resolves to the existing row with 200, a new movement gets 201
- [x] `POST /api/exercises` with `withUser` → `idempotencyMiddleware` → `validateBody`
- [x] `createCustomExerciseSchema` — 2–80 chars, and closed vocabularies for muscle group
      and equipment so a new row can't land outside the picker's own filters
- [x] `core/api/exercises.ts` (the catalog fetch moved out of the hook) and
      `apiExerciseToCatalogExercise` in `features/body/mappers.ts`
- [x] `useExercises` gained `createExercise` / `isCreating`, updating the cached catalog
      with `setQueryData` instead of refetching ~900 rows
- [x] `ExercisePickerSheet` — "Add \"<query>\"" in the empty state, "Can't find it?" below
      results, and an inline form (name + muscle + equipment) that says the exercise is
      shared. Creating selects it immediately.

## Task 6 — Colour

Measured before changing anything (`prefers-color-scheme` both ways, WCAG 2.1 on the actual
token values):

- [x] `--ink-3` — the app's `--muted-foreground`, spent on 11px nav labels, card sublines
      and form hints — measured **3.70:1** on a light card and **4.26:1** on a dark one.
      Retuned to `24 9% 42%` (5.31:1) and `30 7% 62%` (6.77:1).
- [x] Dark-mode accents brought back onto the light palette's hues and off 100% saturation:
      terracotta `18 100% 61%` → `14 70% 62%`, gold `43 100% 64%` → `38 80% 62%`,
      info `206 100% 68%` → `212 75% 66%`. All still ≥6.5:1 on the dark ground. This
      finishes for the accents what the 2026-08-14 phase did for sage.
- [x] Dark `--chart-2/3/4` now point at `var(--terracotta)` / `var(--gold)` / `var(--info)`
      instead of repeating their literals
- [x] Light-mode `--primary` left alone: it measures 6.58:1: retuning it to the lighter
      brand sage would have dropped `text-primary` to ~4.0:1 and failed AA.

## Verification

- [x] `backend: npx tsc --noEmit` — clean
- [x] `backend: npx vitest run` — 253 passed, 30 files (5 new exercise-model tests, 4 new
      route tests for POST /api/exercises)
- [x] `frontend: npx tsc --noEmit` — clean
- [x] `frontend: npx vitest run` — 244 passed, 36 files (4 nav tests, 5 picker tests)
- [x] `frontend: npm run build` — clean
- [x] Migrations run against a live database — CI's `migrations` job applied both against
      Postgres 15 (`Migrations complete!`) and its `initschema` pass confirms `db/schema.ts`
      and the migration history still agree, which is the risk in touching both
- [x] CI green on PR #270 — all 11 checks
- [ ] Visual pass in both themes on a device

## Deliberately not done

- **`trainer_clients` / `trainer_invitations` are not dropped.** Nothing reads them; the
  data is preserved until the owner says otherwise. Both bootstrap paths still create them,
  marked legacy, so they stay in step.
- **Historical `subscription_source = 'trainer'` grants stand.** Those users keep their Pro.
- **No moderation for custom exercises.** They are live to everyone on create, as asked;
  admin already has catalog edit/delete for cleanup.
- **`GET /api/exercises/:id` 404 body changed** from `{ error: 'Exercise not found' }` to the
  standard `{ error: { code, message } }` envelope, because the route moved onto
  `sendError`. The web client reads `error.message`, so this is a fix rather than a break —
  but it is a wire change, and it is the only one in this work.
</content>
