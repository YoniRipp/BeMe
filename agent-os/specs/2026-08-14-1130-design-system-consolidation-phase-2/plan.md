# Plan — Design System Consolidation, Phase 2

Status: implemented. Net −547 lines across 43 files.

## 1. Fold PulseCard into Card

- [x] Verify the two are identical markup (`rounded-[22px]` === `rounded-2xl` === 22px)
- [x] Replace 28 `<PulseCard>` usages across 12 files with `<Card>`
- [x] Merge the `ui/card` import where one already existed, add it where not
- [x] Delete `PulseCard`

## 2. Promote the rest of Pulse into ui/

- [x] `components/ui/page.tsx` — `Page`, `PageHeader`, `SectionHeader`
- [x] `components/ui/progress-ring.tsx` — `ProgressRing`, with a **required** `label`,
      optional `valueText`, `role="progressbar"` and `aria-valuenow`; the SVG and the
      centred children are `aria-hidden` so the value is announced once, not twice
- [x] `components/ui/quick-tile.tsx` — `QuickTile`, `BackButton` (raised to `h-11 w-11`)
- [x] `components/ui/audio-wave.tsx` — `AudioWave`
- [x] Delete `PulseStatCard` (zero usages) and the whole `components/pulse/` folder
- [x] Supply `label` / `valueText` at both ring call sites — the compiler caught both

## 3. Delete dead components

- [x] `shared/AreaCard.tsx`, `shared/QuickStat.tsx`, `shared/SectionHeader.tsx`,
      `shared/StatCard.tsx` — all zero usages
- [x] `voice/VoiceAgentButton.tsx` — 223 lines rendered by nothing; only two doc comments
      referenced it, both corrected

## 4. One empty state

- [x] Merge `EmptyStateCard` into `EmptyState`; delete `EmptyStateCard`
- [x] Action is a real `<button>` at `min-h-11`, not a `div role="button"` with hand-rolled
      key handling
- [x] `role="status" aria-live="polite"` so a filter that empties the list is not silent
- [x] Migrate 3 `EmptyStateCard` call sites (Body, Energy, Goals) and absorb Body's
      hand-rolled "No workouts match" card
- [x] Rewrite `EmptyState.test.tsx` against the merged API — 6 cases including keyboard
      activation and the "label without handler renders nothing" guard

## 5. Name the type sizes, snap the radii

- [x] `tailwind.config.js` — `fontSize.eyebrow` (0.6875rem), `fontSize.caption` (0.625rem),
      size only
- [x] Replace `text-[11px]` (34) and `text-[10px]` (30) across 24 files
- [x] Snap `rounded-[14px]` → `rounded-lg`, `rounded-[22px]` → `rounded-2xl`,
      `rounded-[10px]` → `rounded-sm` — all exact matches on the existing scale
- [x] Confirm the tokens actually emit CSS in the built bundle
      (`.text-eyebrow{font-size:.6875rem}`) rather than silently doing nothing

## Verification

- [x] `npx tsc --noEmit` — clean
- [x] `npx vitest run` — 227 passed, 36 files
- [x] `npm run build` — clean
- [x] No `Pulse*` references remain anywhere in `src/`
- [x] New tokens verified present in `dist/assets/*.css`
- [ ] `npx playwright test` — not run here; no browser/server in this container
- [ ] Visual pass: the empty states on Body / Energy / Goals, and the two progress rings

## Open decision for the owner

`rounded-xl` (45 call sites) resolves to Tailwind's default 12px because the config never
defines `xl` — so it is **smaller** than `rounded-lg` (14px) and identical to `rounded-md`.
Fixing the scale means `xl: calc(var(--radius) + 4px)` = 18px, which visibly changes all 45.
Left undecided; the four remaining arbitrary radii (18px, 20px, 24px ×2) are waiting on it.

## Still ahead

| Phase | Work |
|---|---|
| 3 | Retune dark `--sage` (`83 83% 64%`) into the sage family; sweep the 25 files carrying hardcoded palette colors — `AiInsightsSection` (21), `AiChatPanel` (14), `DataExportModal` (10) |
| 4 | Remaining a11y: unlabelled buttons, `DialogDescription` on 14 dialogs, `inert` on the closed sidebar, `inputMode` on 38 numeric fields, 44px floor on `SetRow` steppers / rest-timer chips / Body filter chips |
| 5 | Recents & frequents in the food modal; rest timer auto-starting on set completion; haptics; per-card skeletons on Home; loading and empty states on Insights |
