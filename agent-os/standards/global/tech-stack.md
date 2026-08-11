# Tech Stack

## Frontend

- React 18 + TypeScript, Vite
- Tailwind CSS + shadcn/ui (`src/components/ui/`)
- TanStack Query for all server state
- React Router (`src/routes.tsx`)
- PWA: service worker at `src/sw.ts`, offline mutation queue

## Backend

- Node.js + Express, TypeScript, ES modules
- **All new backend files must be `.ts`**
- Relative imports carry the `.js` extension (ESM requirement): `import ... from '../errors.js'`
- Zod for env config and request validation
- BullMQ (Redis) or SQS for the event bus

## Database

- PostgreSQL via `pg`, raw SQL (no ORM)
- Migrations: `node-pg-migrate` in `backend/migrations/`

## Other

- Gemini for voice parsing and AI insights
- Redis for queues, caching, job state
- Mobile: Expo React Native app in `mobile/`; TWA wrapper in `twa/`
- Tests: Vitest (unit, co-located `*.test.ts`), Playwright (`frontend/e2e/`)
