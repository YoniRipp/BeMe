# Plan — Frontend UI/UX Remediation, Phase 1

Status: implemented.

## 1. Workout editor no longer reverts logged sets

- [x] `Body.tsx` — hold `editingWorkoutId`, derive `editingWorkout` from the live list
- [x] `WorkoutModal.tsx` — key the editor `reset()` on `[open, workout?.id, mode, reset]`
- [x] `WorkoutModal.tsx` — key the mode-reset effect on `workout?.id`, so a logger autosave
      no longer throws the user out of the editor
- [x] `Body.test.tsx` — log a set, re-render from the cache, save from the editor, assert
      `completedPerSet` survives (fails on the old code)
- [x] `WorkoutModal.test.tsx` — a refetch mid-edit must not reset the form (fails on the
      old deps)

## 2. Dictation no longer drops what was said

- [x] `useVoiceDictation` — `onAutoEnd` option, held in a ref so the memoised
      `startRecognition` always reaches the current callback
- [x] `onend` — when no `stop()` is pending and the transcript is non-empty, hand it over
      instead of discarding it
- [x] `AiChatPanel` — pass `onAutoEnd` to fill the composer; mirror `dictation.error` to a
      toast, since `VoiceRecorderBar` unmounts exactly when failures surface
- [x] `useVoiceDictation.test.ts` — three cases against a fake Web Speech API: auto-end
      hands over, explicit `stop()` does not double-deliver, silence delivers nothing

## 3. Scrim and status tokens

- [x] `index.css` — `--scrim` (dark in both themes), `--info-foreground`,
      `--success-foreground`
- [x] `tailwind.config.js` — register `scrim`; give `info` / `success` `-foreground` pairs
- [x] `dialog.tsx` `bg-foreground/50` → `bg-scrim/50`
- [x] `sheet.tsx` `bg-black/80` → `bg-scrim/50` + `backdrop-blur-sm`, matching Dialog
- [x] `Base44Layout` sidebar overlay `bg-charcoal/40` → `bg-scrim/50`
- [x] `Water.tsx` and `SetRow.tsx` — `text-white` → the matching `-foreground` token
- [x] Delete `--cream`, `--cream-warm`, `--charcoal`, `--stone`, `--mist`,
      `--border-base44` from `index.css` and `tailwind.config.js` — all aliased ink/paper
      and would reintroduce the inversion

## 4. Toasts clear the bottom navigation

- [x] `ToastProvider` — `top-center` on mobile via `useIsMobile`, `bottom-right` on desktop

## 5. Dead code

- [x] Delete `components/shared/QuickAddMenu.tsx` — mounted in `Base44Layout` but
      `setQuickAddOpen` was never called anywhere
- [x] Remove its state, render, import and test mock
- [x] Collapse `getBottomNav`'s unreachable trainer branch into `BOTTOM_NAV_TRAINER`

## 6. One voice entry point per viewport

- [x] Drop the `pathname !== '/'` gate so the desktop mic FAB covers Home
- [x] Remove `VoiceMicHero` from Home and delete the now-orphaned component
- [x] Drop the `openVoiceAgent` outlet context, which had no remaining consumer
- [x] Update `agent-os/standards/frontend/mobile-ui.md` — the FAB now appears on every page
- [x] `Home.test.tsx` — assert Home does not duplicate the layout's voice control

## 7. Water logs in one request

- [x] `useWater` — `setGlasses(n)` via `waterApi.upsert`, optimistic `onMutate` /
      rollback `onError` / `onSettled` invalidate
- [x] `Water.tsx` — `setTarget` calls it once; drop the per-glass `await` loop and the
      `busy` state that disabled the whole grid
- [x] Wrap the card in `ContentWithLoading` so a cold load isn't shown as "0 of 8"
- [x] Fix the duplicate accessible names on the tiles (`aria-label="Glass N"` +
      `aria-pressed`)
- [x] `Water.test.tsx` — one request not N, optimistic paint before the response,
      rollback on failure, last-tile empties

## Verification

- [x] `npx tsc --noEmit` (frontend) — clean
- [x] `npx vitest run` — 227 passed, 36 files
- [x] `npm run build` — clean, PWA manifest regenerated
- [x] No stale references to the six deleted tokens anywhere in `src/`
- [x] Zero backend files touched
- [x] `npx playwright test` — run against the branch (chromium): 8 passed, 35 failed.
      Every failure is pre-existing, not a regression — the suite targets `/money`,
      `/schedule` and `/groups`, routes this app does not have, expects `/welcome`
      redirects where the app sends users to `/login`, and looks for landing copy
      that does not exist on `main` either. No CI workflow runs Playwright, which is
      how it drifted. Rewriting it is its own piece of work.
- [ ] Manual dark-mode pass on a phone viewport (scrims, toast placement, Water tap latency)

## Follow-ups (not in scope here)

| Phase | Work |
|---|---|
| 2 | Promote Pulse into `components/ui/`; delete `AreaCard` / `QuickStat` / `SectionHeader` (zero usages) and the unrendered `VoiceAgentButton`; unify `EmptyState` + `EmptyStateCard`; name `text-[11px]` / `text-[10px]`; fold the six arbitrary radii into the `--radius` scale |
| 3 | Retune dark `--sage` into the sage family; sweep the 25 files with hardcoded palette colors (`AiInsightsSection` 21, `AiChatPanel` 14, `DataExportModal` 10) |
| 4 | Accessibility: 45 files with unlabelled buttons, 14 dialogs without `DialogDescription`, `role="progressbar"` on `PulseRing` and Body's week ring, `inert` on the closed sidebar, `inputMode` on 38 numeric fields, 44px floor on `SetRow` steppers / rest-timer chips / Body filter chips |
| 5 | Recents & frequents in the food modal; rest timer auto-starting on `onToggleComplete` with a real notification; `@capacitor/haptics`; per-card skeletons on Home; loading + empty states on Insights |

The rest-timer chips' sub-44px targets were already recorded as a deliberate deferral in
`2026-08-11-0730-workout-per-exercise-editing/plan.md`; Phase 4 is where that debt is paid.
