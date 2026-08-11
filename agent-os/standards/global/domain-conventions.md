# Domain Conventions

Non-obvious rules that cause real bugs when missed.

## Units and time

- **Dates** — local calendar `YYYY-MM-DD`. Not UTC, not ISO timestamps, for anything day-scoped.
- **Week** — Sunday to Saturday.
- **Weight** — kilograms, in workouts and in voice parsing.

## Nutrition

- `foods` stores nutrition **per 100g/100ml**.
- `food_entries` stores values **already scaled to the logged portion**.
- Converting between the two is the caller's job — reading a `foods` row and displaying it as an entry's calories is wrong by a factor of portion/100.

## Meal types

`food_entries.meal_type` is one of `breakfast`, `lunch`, `dinner`, `snack`.

- Set explicitly when the user picks a meal section or uses voice inside one.
- Entries **without** `mealType` fall back to time-based inference. Keep that fallback — old rows have no meal type.

## Voice-first

Voice is the primary path for food logging; manual search/barcode/form entry is secondary. A new food-logging capability should be reachable by voice, not only by form.
