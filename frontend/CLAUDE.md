# Frontend

React 18 SPA built with Vite, TypeScript, React Query, Tailwind CSS, and shadcn/ui.
Ships as a web app, a PWA (`src/sw.ts`), and a Capacitor native shell.

## Commands
- Dev server: `npm run dev`
- Typecheck: `npx tsc --noEmit`
- Build: `npm run build`
- Tests: `npx vitest run`
- E2E tests: `npx playwright test`
- Capacitor (mobile): `npm run cap:sync`, `npm run cap:ios`, `npm run cap:android`

## Architecture
- `src/routes.tsx` — route table; `src/App.tsx` and `src/Providers.tsx` wrap the tree
- `src/pages/` — page components. App pages: `Home`, `Body` (workouts), `Energy`
  (food/journal), `Water`, `Goals`, `Insights`, `Settings`, `Trainer`,
  `TrainerClientView`, `Admin` (+ `pages/admin/`). Auth: `Login`, `Signup`,
  `ForgotPassword`, `AuthCallback`. Marketing: `Landing`, `Pricing`, `About`,
  `Contact`, `Privacy`, `Terms`, `NotFound`.
- `src/components/` — UI organized by domain: `layout/`, `home/`, `body/`, `energy/`,
  `goals/`, `insights/`, `chat/`, `voice/`, `trainer/`, `admin/`, `onboarding/`,
  `subscription/`, `marketing/`, `settings/`, `pwa/`, `shared/`, `ui/`, `auth/`
- `src/components/ui/` is **the** design system — shadcn primitives (`dialog`, `sheet`,
  `input`, `select`, …) plus the app's own (`card`, `page`, `progress-ring`, `quick-tile`,
  `audio-wave`). Reach for one of these before writing a styled div. `shared/` is for
  composite helpers (`EmptyState`, `ContentWithLoading`, `ImagePlaceholder`), not for a
  second set of primitives.
- `src/hooks/` — React Query data hooks (`useWorkouts`, `useGoals`, `useEnergy`,
  `useWater`, `useWeight`, `useCycle`, `useStreaks`, `useTrainer`, `useSubscription`, …)
  plus device hooks (`useSpeechRecognition`, `useNativeSpeech`, `useIsMobile`, …)
- `src/context/` — `AppContext`, `AuthContext`, `NotificationContext`
- `src/features/` — feature-scoped logic: `auth/`, `body/`, `energy/`, `goals/`,
  `settings/`
- `src/core/api/` — typed API clients per domain (`workouts`, `food`, `goals`, `chat`,
  `aiInsights`, `trainer`, `admin`, `subscription`, `push`, `health`, `users`, `auth`)
- `src/lib/` — utilities: date ranges, storage, offline sync queue, analytics, feature
  flags, push subscription, voice helpers, theme palette
- `src/schemas/` — Zod schemas shared by forms and API payloads

## Patterns
- Path alias: `@/` maps to `src/`
- Data fetching: React Query hooks in `src/hooks/`; keys follow `[domain, ...params]`
- API calls go through `src/core/api/` — don't call `fetch` from components
- UI: Tailwind utility classes + shadcn/ui components
- Routing: React Router with lazy-loaded pages
- State: React Query for server state, React Context for shared client state
- Navigation: tab set defined in `components/layout/Base44Layout.tsx`, rendered by
  `components/layout/BottomNavigation.tsx` (role-dependent, with a center mic button)
- Missing images render `components/shared/ImagePlaceholder.tsx` — there are no
  placeholder image assets
- Tests: Vitest + React Testing Library for unit tests, Playwright for E2E
