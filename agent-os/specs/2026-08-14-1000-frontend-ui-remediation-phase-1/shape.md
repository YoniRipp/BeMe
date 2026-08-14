# Frontend UI/UX Remediation, Phase 1 — Shaping Notes

## Where this came from

A UI/UX audit of `frontend/src` (176 components, 27 pages) plus a code-review pass over
this branch's diff against `main`. The audit's central finding is structural: the app is
mid-redesign. A "Pulse" design language was layered on top of the existing shadcn +
`shared/` layer and neither older layer was retired, so three UI vocabularies coexist.
Most visible inconsistency traces back to that one fact.

Phase 1 deliberately does **not** attempt the consolidation. It takes the two data-loss
bugs, the dark-mode inversions, and the global chrome that actively fights the user — the
things that are wrong rather than merely inconsistent.

## Decisions

Three were settled with the product owner before implementation:

- **The brand accent is sage.** Dark mode currently ships a bright lime (`83 83% 64%`)
  against light mode's muted sage (`148 24% 42%`) — a 65° hue shift and 24%→83% saturation.
  `frontend/design-tokens` already names sage as the brand accent, so dark mode is what
  moves. Deferred to Phase 3; recorded here so the direction isn't relitigated.
- **Pulse becomes the design system.** Its primitives get promoted into `components/ui/`
  and the `shared/` display layer retires. Deferred to Phase 2.
- **Phase 1 is bugs + dark mode + chrome**, shipped as one reviewable PR.

Implementation decisions taken here:

- **Fix the stale workout at the source, not the symptom.** `Body.tsx` held
  `editingWorkout` as a `Workout` snapshot captured when the card was tapped. Rather than
  patching the modal to re-read, the page now holds an **id** and derives the object from
  the live `workouts` list, so the prop follows the react-query cache. No new query.
- **Keying the editor's `reset()` on `workout?.id`, not `workout`.** Making the prop live
  introduces a second hazard: `workout` identity now changes on every cache write, and the
  original deps `[open, workout, reset]` would reset the form under a user mid-edit. The
  effect keys on `[open, workout?.id, mode, reset]` — `mode` is what picks up sets logged
  in the view we just came from. The same change was needed on the mode-reset effect,
  which would otherwise throw the user out of the editor on every logger autosave.
- **A `--scrim` token rather than per-component fixes.** `--charcoal` aliased `--ink`,
  which is near-white in dark mode, so `bg-charcoal/40` painted a white wash. The same
  class of bug existed in `dialog.tsx` (`bg-foreground/50`). One token defined dark in both
  themes fixes the dialog, the sheet and the sidebar together — and the sheet's divergent
  `bg-black/80` stops being a third value.
- **No backend change for Water.** `PUT /api/water-entries` already accepts an absolute
  count (`upsertWaterEntrySchema`), so the N-sequential-requests problem is fixable purely
  client-side. Honors the rule against changing API shapes.
- **`addGlass` / `removeGlass` stay.** `WaterTracker` on Home uses them; `setGlasses` is
  added alongside rather than replacing them.

## Constraints

- The workout logger is live and in daily use — per-exercise actions and set logging must
  keep working exactly as they do. The `WorkoutDetailView` re-seed guard keyed on
  `[workout.id]` is deliberately untouched.
- `--info` and `--success` lighten considerably in dark mode, so anything sitting on them
  needs a `-foreground` pair rather than a literal `text-white`.
- Removing Home's mic hero can't cost desktop users their only voice control (see below).

## The one behavior change, and why it needed a standard update

Home carried `VoiceMicHero` — a 96px mic card whose own subtitle read *"Opens the same
Voice Agent as the bottom mic."* On mobile that is a straight duplicate of the bottom nav's
centre mic.

On **desktop** it was not a duplicate: the bottom nav is `lg:hidden`, and the global mic FAB
was gated on `pathname !== '/'`, so the hero was the only voice entry point on desktop Home.
Deleting it alone would have removed a working capability.

So the gate came off the FAB first, making it universal, and the hero then became a pure
duplicate and was removed. `agent-os/standards/frontend/mobile-ui.md` documented the old
"every page **except Home**" rule and was updated in the same commit — this reverses a
recorded decision rather than fixing an oversight.

## Found while implementing

- **Two water tiles produced identical accessible names.** With 3 glasses logged, both the
  2nd tile (fill to 2) and the 3rd (empty back to 2) labelled themselves "Set water to 2
  glasses". Switched to the idiomatic toggle pattern: `aria-label="Glass N"` naming the
  thing, `aria-pressed` carrying the state. Surfaced by a test, not by reading.
- **`VoiceAgentButton.tsx` (223 lines) is rendered by nothing.** Only doc comments in
  `voiceActionExecutor.ts` and `voiceApi.ts` mention it. It predates this work and is left
  alone rather than widening the diff — noted for Phase 2's dead-code sweep.
- **The first regression test was written at the wrong level.** A harness that fed
  `WorkoutModal` a live prop made the *old* code pass, because a live prop is itself the
  fix. The data-loss test belongs in `Body.test.tsx`, where the snapshot lived; the modal
  test instead covers the hazard the deps change guards against.

## Standards Applied

- `frontend/design-tokens` — the `--scrim`, `--info-foreground` and `--success-foreground`
  additions; deletion of the aliases that inverted
- `frontend/mobile-ui` — one voice entry point per viewport; toast placement clear of the
  bottom nav
- `frontend/data-fetching` — `setGlasses` uses the standard optimistic
  `onMutate` / `onError` / `onSettled` triad against `queryKeys.waterToday`
- `frontend/components` — reuse `ContentWithLoading` and `useIsMobile` rather than new code
- `global/critical-rules` — no working feature removed; the desktop voice path was restored
  before the duplicate was deleted
