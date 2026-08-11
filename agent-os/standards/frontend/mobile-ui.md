# Mobile UI

This is a mobile app that runs in a browser. Design for a thumb, not a mouse.

- Vertical scrolling, one column. No desktop dashboard grids.
- Card-based: every food, workout, and exercise item is a card — `rounded-2xl`, `shadow-card`, generous padding.
- Spacing scale: `4 · 8 · 12 · 16 · 24 · 32`px. Never let content touch the screen edge.
- Touch targets ≥ 44px. Icon-only buttons still need a 44px hit area.

## Safe areas

Fixed-position elements must respect the notch and home indicator. Use the utilities, not inline styles:

```
.pb-safe  →  padding-bottom: env(safe-area-inset-bottom, 0px)
.pt-safe  →  padding-top: env(safe-area-inset-top, 0px)
```

Anything pinned above the bottom nav offsets from it:
`bottom-[calc(env(safe-area-inset-bottom,0px)+9.75rem)]`

## Navigation

`BottomNavigation` is fixed to the bottom, icon + label, thumb-reachable. The global Voice Agent FAB appears on every page **except Home**.

## Card anatomy

```
FoodCard          [image] · name · portion · calories      e.g. Chicken Breast / 200g / 330 kcal
WorkoutCard       name · exercise list · sets × reps       e.g. Push Day / Bench Press / 4 × 8
ExerciseItem      name · sets · reps · optional image      e.g. Bench Press / 4 sets × 8 reps
```

Food and workout names are the largest text in a card; calories and sets×reps are secondary but readable. Calories get visual emphasis. Exercises within a workout are clearly separated and scannable.

## Common UI bugs to fix on sight

Broken alignment · text overflow · inconsistent spacing · elements touching screen edges · touch targets under 44px · layouts that don't reflow on small screens.

Images are square with rounded corners and a consistent size. Missing images fall back to `food-placeholder.png` / `exercise-placeholder.png` — never render a broken image or empty box.
