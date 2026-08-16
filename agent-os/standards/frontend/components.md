# Component Architecture

Small, focused, reusable. No monolithic page components.

Components are grouped by domain under `src/components/` (`body/`, `energy/`, `goals/`, `voice/`, …), with `ui/` for shadcn primitives, `shared/` for cross-domain pieces, and `layout/` for shells.

Canonical reusable pieces — extend these rather than re-inventing:

```
FoodCard · WorkoutCard · ExerciseList · BottomNavigation · ImagePlaceholder
```

- **Reach for `components/ui/` first.** A new styled `<div>` that duplicates `card.tsx` or `button.tsx` is a bug.
- **Pages compose, they don't style.** Layout and data wiring in `pages/`, presentation in components.
- **Feature logic lives in `features/<domain>/`** (api, mappers, derived state like `useGoalProgress`), not inside components.
- Import via the `@/` alias, never long relative chains.

## Performance

- No unnecessary re-renders — memoize callbacks passed to list children.
- Keep DOM nesting shallow; deep wrapper stacks make scrolling janky on mid-range Android.
- Long lists render as cards, not tables.
