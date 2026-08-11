# Testing

- **Unit tests co-locate** with the file under test: `auth.ts` → `auth.test.ts`. Not in a `__tests__/` folder.
- **Vitest** both sides. **Playwright** for E2E in `frontend/e2e/*.spec.ts`.

```bash
npm run test:all                      # backend + frontend, single pass
npm run test:backend                  # backend unit
cd frontend && npm run test -- --run  # frontend unit, single pass
cd frontend && npm run test:e2e       # Playwright
```

**Run the frontend suite from `frontend/`.** The root `test` script is `cd frontend && npm run test`, and npm does not forward args through a nested `npm run` — `npm run test -- --run` at the root drops `--run`, leaving vitest in watch mode and hanging the terminal. `npm run test:all` is safe because its `--` is inside the script string.

- `npm run lint` is `tsc --noEmit` — a type error is a lint failure. Run it in whichever package you touched; there is no root `tsconfig.json`.
- Backend layers are tested at their own level: middleware and controllers get their own tests, services are tested through their public functions.
- CI runs lint + tests on push and PR to `main` (`.github/workflows/ci.yml`).
