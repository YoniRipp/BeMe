# Workout Section — Design Concepts

Design-review mockups for redesigning the Workouts (Body) section. These are
**static previews only** — no application code is changed by anything in this folder.

Each concept is shown on **mobile and desktop** using beme's real design tokens
(sage/paper palette, Fraunces + Inter, shadows, radii), the bottom-nav + mic FAB,
and the desktop sidebar.

| # | Concept | Inspired by |
|---|---------|-------------|
| 1 | Session Log | Strong |
| 2 | Activity Hero | Apple Fitness |
| 3 | Cover Cards | Nike Training Club |
| 4 | Diary List | MyFitnessPal |
| 5 | Stat Card | Hevy |

## Files
- `workout-designs.html` — the full gallery (open directly in a browser)
- `design-1.png … design-5.png` — rendered previews (mobile + desktop per concept)
- `shoot.mjs` — Playwright script that renders the PNGs from the HTML

## Regenerate the screenshots
```bash
cd design-mockups
npm install                       # installs playwright
npx playwright install chromium   # one-time browser download
PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers node shoot.mjs
```
