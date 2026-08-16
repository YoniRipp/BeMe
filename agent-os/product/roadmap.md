# Product Roadmap

## Phase 1: Shipped

- **Body** — workout logging (sets, reps, kg), workout types, streaks and frequency charts, exercise catalog with images/video
- **Energy** — food tracking with full macros, daily check-ins and sleep, calorie/macro trends, barcode scanning (Open Food Facts)
- **Voice Agent** — natural language for all operations via Gemini function calling; text mode sync, audio mode async via Redis queue
- **Goals** — calories/workouts/sleep against weekly, monthly, or yearly targets
- **Additional tracking** — weight, water, menstrual cycle, user profile
- **Identity** — email/password, social login, JWT sessions, admin role
- **Platform** — PWA with offline mutation queue, Expo mobile app, TWA Android wrapper

## Phase 2: In flight

- **UI/UX production polish** — the current focus. Make the app feel like a shipped consumer product rather than a prototype, without breaking working features.
- **Payment processing** — replacing Lemon Squeezy with Max/Hyp clearing. See `agent-os/specs/2026-08-11-0000-max-hyp-payment-processing/`.

## Phase 3: Planned

- **Meal plans** — named plans ("Cutting Diet") with foods per meal
- **CSV import** — bulk-create a week of entries from a spreadsheet
- **Recurring schedules** — "apply this plan Monday through Friday"
- **Meal templates** — save a day's entries, re-apply with one tap

Today's workaround for repetition is the `copy_food_entries` voice command.

## Architectural direction

Bounded contexts (`identity`, `body`, `energy`, `goals`, `voice`) are logical modules in one app today, each mountable as a standalone service via config flags. Extraction should be a move of code, not a redesign.
