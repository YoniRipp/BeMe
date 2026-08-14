# Plan — Palette, Accessibility and Logging Speed (Phases 3–5)

Status: implemented.

## Phase 3 — one identity across themes

- [x] Dark `--sage` retuned from `83 83% 64%` (lime) to `148 45% 58%` — same hue family as
      light mode, ~9:1 against the background in both directions
- [x] Every dark token that repeated the accent literally now points at `var(--sage)`
- [x] Dark neutral ramp unified: it ran across 12° (paper), 138° (ink) and 200° (surfaces);
      now one warm family matching light mode
- [x] 23 files swept off raw Tailwind palette classes onto semantic tokens
- [x] `CHART_COLORS` and five chart components moved off fixed hexes onto `--chart-*`,
      which existed and were unused
- [x] Login and Signup converted off a hand-painted dark theme (`#0b0d0c` grounds,
      `#9cf25b` buttons) built on the retired lime
- [x] Ten no-op hover states fixed — collapsing shade pairs onto one token had made
      `hover:text-destructive` sit on an element already `text-destructive` (four predate
      this work)
- [x] A `from-violet-50 / to-indigo-50` card became a gradient to itself; replaced with a
      flat tint that needs no `dark:` variant

## Phase 4 — accessibility

- [x] Closed sidebar goes `inert` below `lg`, so its links leave the tab order; Escape
      closes it; three tests
- [x] Every dialog now has a description (14 had none); two with no header at all — the
      image lightbox and the video player — gained titles
- [x] Touch targets in the gym path: set steppers 36×28 → 36×44, set value input → 44 tall,
      mark-set-done 36×36 → 44×44, rest timer chips ~26 → 44, Body filter chips ~32 → 44,
      video close button (unsized) → 44×44
- [x] Body's weekly ring replaced with `ProgressRing`, which labels it; day tiles gained
      day name, today, and logged/not-logged
- [x] Body filter chips became a labelled toggle group with `aria-pressed`
- [x] `inputMode` on 38 numeric inputs
- [x] `useMediaQuery` added (the sidebar needs `lg`, `useIsMobile` is fixed at 768) and a
      `matchMedia` stub in `setupTests`

## Phase 5 — perceived speed and the competitor gaps

- [x] Insights had no loading and no empty state — charts mounted over empty arrays and
      rendered zeros. Now skeletons while loading, and an invitation when there is nothing
      to plot. Five tests, including the zero-state.
- [x] Home no longer gates the whole dashboard on the slowest of three queries. The fuel
      card waits only on food entries; recent activity has its own skeleton; `goalsLoading`
      is gone entirely — it delayed the page for data Home never renders.
- [x] `useRecentFoods` + `RecentFoodsStrip` — one-tap re-log above the food modal's search
      field, ranked by frequency at the current meal, then overall, then recency. Bounded
      scan over cached entries, no new request. Seven tests.
- [x] Rest timer auto-starts on set completion (`useRestTimer`), the behaviour Hevy and
      Strong are built around. Deadline-based rather than a decrementing counter, because
      the interval freezes when the phone sleeps — which is exactly when someone is
      resting. Fires a notification, falling back to a toast when permission was never
      granted.
- [x] `lib/haptics` — light impact on set-complete and water, success on rest-complete.
      Uses the Vibration API rather than adding `@capacitor/haptics`; respects
      `prefers-reduced-motion` and no-ops where unsupported.

## Verification

- [x] `npx tsc --noEmit` — clean
- [x] `npx vitest run` — 238 passed, 37 files
- [x] `npm run build` — clean
- [x] `npx playwright test` — run against the branch (chromium): 8 passed, 35 failed.
      Every failure is pre-existing, not a regression — the suite targets `/money`,
      `/schedule` and `/groups`, routes this app does not have, expects `/welcome`
      redirects where the app sends users to `/login`, and looks for landing copy that
      does not exist on `main` either. No CI workflow runs Playwright, which is how it
      drifted. Rewriting it is its own piece of work.
- [ ] Visual pass in both themes, and a device check for the haptics and the rest timer
      surviving a backgrounded app

## Still open

`rounded-xl` resolves to Tailwind's default 12px because the config never defines `xl`,
making it smaller than `rounded-lg` (14px) and identical to `rounded-md`. Fixing the scale
changes 45 call sites visibly, so it remains the owner's decision. Four arbitrary radii
(18px, 20px, 24px ×2) wait on it.

iOS gets no haptics: the Vibration API is unimplemented in Safari and the iOS WebView.
Adding `@capacitor/haptics` is the upgrade path if that matters.
