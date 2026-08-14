# References for Frontend UI/UX Remediation, Phase 1

## Source of the work

The full UI/UX audit is published at
<https://claude.ai/code/artifact/43e47630-9b52-4647-a739-0171a8400edc> — 176 components and
27 pages, with the design-system drift, dark-mode inversions, accessibility ledger and a
comparison against MacroFactor, Strong and Hevy. Phase 1 implements its §9 steps 1–4.

## Code changed

### Workout page and modal
- **Location:** `frontend/src/pages/Body.tsx`, `frontend/src/components/body/WorkoutModal.tsx`
- **Relevance:** The page owned the stale snapshot; the modal owned the effect deps that
  had to change once the prop became live.
- **Key pattern:** `commit()` in `WorkoutDetailView` — debounced, optimistic, flushed on
  unmount. Untouched. Its re-seed guard keyed on `[workout.id]` is what keeps a background
  refetch from clobbering in-progress logging, and it documents its own reasoning.

### Voice dictation
- **Location:** `frontend/src/hooks/useVoiceDictation.ts`
- **Relevance:** `onend` fires for two different reasons — an explicit `stop()` (resolved
  through `resolveStopRef`) and the engine giving up on its own. Only the first had a
  destination for the transcript.
- **Key pattern:** callbacks reach the memoised `startRecognition` through a ref, so the
  recogniser isn't torn down and rebuilt when the caller re-renders.

### Water
- **Location:** `frontend/src/hooks/useWater.ts`, `frontend/src/pages/Water.tsx`
- **Relevance:** The N-requests-per-tap problem and its fix.
- **Key pattern:** the backend derives `ml_total` as `glasses * 250`
  (`backend/src/models/water.ts:54`); the optimistic value mirrors that constant so the
  pre- and post-response numbers agree and the UI doesn't flicker.

### Design tokens
- **Location:** `frontend/src/index.css`, `frontend/tailwind.config.js`
- **Relevance:** Where the inverting aliases lived and where `--scrim` was added.

## Endpoint reused, not added

`PUT /api/water-entries` — `backend/src/routes/water.ts:15`, validated by
`upsertWaterEntrySchema` (`backend/src/schemas/routeSchemas.ts:172`), already exposed as
`waterApi.upsert` in `frontend/src/core/api/health.ts:72`. It accepts
`{ date, glasses?, mlTotal? }` and was the reason no backend change was needed.

## Code-review findings folded in

Four of the fifteen findings from the review pass over this branch's diff are addressed
here: the workout editor overwrite, the dropped dictation transcript, the dialog overlay
inversion, and the sheet/dialog scrim mismatch.

The remaining eleven — the note editor re-anchoring after a reorder, the dialog close
button scrolling out of view with `overflow-y-auto`, stale notes carried onto newly added
exercises, `requestAllPages` fetching full history in up to 25 serial round-trips, the
starter templates whose exercise names miss the catalog, the `queryKeys.waterHistory`
invalidation that matches no query, the `VoiceRecorderBar` waveform read during render, and
the `engine` flip between `start()` and `stop()` — are folded into Phases 2–4 by area.

## Competitor behavior cited in the audit

- [NutriScan — MacroFactor vs MyFitnessPal 2026](https://nutriscan.app/blog/posts/macrofactor-vs-myfitnesspal-2026-93f2aa703e) — tap-count comparison, pattern engine
- [Nutrition Apps Ranked — Cronometer vs MacroFactor vs MyFitnessPal](https://nutrition-apps-ranked.com/en/articles/cronometer-vs-macrofactor-vs-myfitnesspal-ranked-2026/)
- [RepReturn — Strong vs Hevy](https://repreturn.com/strong-app-vs-hevy/) — pre-loaded previous-session weights
- [Hevy — workout rest timer](https://www.hevyapp.com/features/workout-rest-timer/) — auto-start on set completion
