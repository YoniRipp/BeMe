# TrackVibe / beme — Engineering Plan

**Date:** 2026-08-01
**Basis:** full check run (typecheck, unit, E2E, build, audit) plus a 7-dimension code audit
(payments, security, backend architecture, frontend/UX, tests, product, devops) with every finding
adversarially re-verified against the source. 129 findings survived verification; 10 are critical.

---

## 1. Executive summary

- **The biggest risk is not code quality — it is that the mobile channel cannot legally ship.**
  The app is packaged with Capacitor (`frontend/capacitor.config.ts`, appId `com.trackvibe.app`) and
  sells a digital subscription through an external web checkout, with zero in-app-purchase code
  anywhere. That is an automatic rejection under App Store Guideline 3.1.1, and Play Billing policy
  applies to the `frontend/android/` build that already exists.
- **A second, independent App Store blocker:** there is no in-app account deletion
  (Guideline 5.1.1(v)). The only delete route is admin-only (`backend/src/routes/users.ts:229`) and
  explicitly refuses self-deletion.
- **One unauthenticated HTTP request can kill the production API.** The Lemon Squeezy webhook
  dereferences `req.body` as a Buffer outside any try/catch; a non-matching Content-Type makes it an
  object, the TypeError becomes an unhandled rejection, and `backend/index.ts:137-140` calls
  `process.exit(1)`. The endpoint is mounted *above* the rate limiter, so it is loopable.
- **The WhatsApp webhook is completely unauthenticated** — no signature verification at all
  (`backend/src/routes/whatsapp.ts:40`) — and it reaches an LLM executor that can write and delete
  user health data.
- **Billing is a happy path with money-losing edge cases.** A paying customer can be charged and
  silently never receive Pro (the entitlement UPDATE matches zero rows and nobody checks
  `rowCount`); refunds and cancellations are not handled; trials are re-runnable indefinitely
  because the trial flag is client-controlled.
- **The test suite is green and largely decorative at the boundaries that matter.** 396 tests pass,
  but zero touch a real Postgres, the entire paid-subscription route is at 0%, and all 3 E2E specs
  test a product surface that was deleted (routes `/money`, `/schedule`, `/groups`).
- **The core product number is a constant.** Onboarding collects sex, DOB, height, weight and
  activity level, and then never computes a calorie target — every user is graded against a
  hardcoded 2,400 kcal until they manually edit macros.
- **The engineering fundamentals are strong** — typecheck clean, both builds succeed, good layering,
  real migrations, atomic quota SQL. The gaps are concentrated in what was never finished, not in
  what was built badly.

---

## 2. What's already strong

Preserve these; several audit recommendations were rejected because the thing already existed.

| Area | Evidence |
|---|---|
| Webhook raw-body ordering | `backend/app.ts:83-87` mounts `express.raw` *before* `express.json()` — the single most common webhook bug, avoided |
| Timing-safe HMAC | `backend/src/routes/subscription.ts:87-88` uses length pre-check + `crypto.timingSafeEqual`, not `===` |
| Race-free quota | `backend/src/services/aiQuota.ts:51-65` does month-rollover and limit check in one atomic `UPDATE … RETURNING` |
| HTTP trainer authorization | `backend/src/routes/trainer.ts:36` + `resolveTrainerClientUserId` (`backend/src/middleware/auth.ts:83-104`) correctly validate client ownership |
| Password-reset token handling | `backend/src/models/user.ts:189,202` — single-use, time-bounded, both columns nulled |
| Fail-closed payment surfaces | checkout/portal 503 when unconfigured (`subscription.ts:16-18, 41-43`) |
| Idempotency middleware | Real and applied to 4 mutating routes (`goal.ts:14`, `workout.ts:14`, `foodEntry.ts:14`, `dailyCheckIn.ts:14`) |
| Health/readiness | `GET /ready` at `backend/app.ts:97` genuinely checks DB (`SELECT 1`) and Redis (`ping`) |
| Structured logging + metrics | Pino, `backend/src/lib/metrics.ts`, `app_logs`, client logger — the record half of observability exists |
| Migrations | 36 real migrations with FKs and cascades; CI provisions pgvector and runs them |
| Event/queue architecture | BullMQ + event bus with DLQ (`backend/src/events/bus.ts:113-128`) |

---

## 3. Health check results

All commands were executed on this branch.

| Check | Command | Result |
|---|---|---|
| Backend typecheck | `tsc --noEmit` | ✅ clean |
| Frontend typecheck | `tsc --noEmit` | ✅ clean |
| Backend unit tests | `vitest run` | ✅ 210/210 (29 files) |
| Frontend unit tests | `vitest run` | ✅ 186/186 (32 files) |
| Backend build | `tsup` | ✅ 280 ms |
| Frontend build | `vite build` | ✅ 8.75 s, PWA 91 precache entries |
| **E2E** | `playwright test` | ❌ **8 passed / 35 failed** — stale specs |
| Backend audit | `npm audit` | ⚠️ 22 vulns (1 low, 10 moderate, 11 high) |
| Frontend audit | `npm audit` | ⚠️ 24 vulns (1 **critical** `tar`, 15 high — mostly devDeps) |
| Backend coverage | `vitest run --coverage` | 21.91% stmts / 17.42% branches |
| Frontend coverage | `vitest run --coverage` | 25.28% stmts / 20.39% branches |

**Note on E2E:** two distinct problems. (a) This container has Chromium build 1194 while
`@playwright/test@1.58.2` wants 1208 — environmental, not a repo defect. (b) With that worked
around, 35 specs still fail because they assert on removed routes (`/money`, `/schedule`,
`/groups` — absent from `frontend/src/routes.tsx`) and a pre-redesign login heading
(`e2e/auth.spec.ts:8` expects `Sign in`; `src/pages/Login.tsx:42` renders `TrackVibe`).
Only the *heading* locators are stale — `getByRole('button', {name: 'Sign in'})` at
`auth.spec.ts:15` still matches `Login.tsx:80`. Repair, don't rewrite.

---

## 4. P0 — Ship blockers

| # | Problem | Evidence | Fix | Effort |
|---|---|---|---|---|
| P0-1 | **Unauthenticated remote crash (full API DoS)** | `subscription.ts:83-85` casts `req.body` to Buffer outside try/catch; body-parser sets `req.body = {}` before the `shouldParse` bail; `index.ts:137-140` exits on unhandled rejection; mounted at `app.ts:85`, above the limiter at `app.ts:148` | `if (!Buffer.isBuffer(req.body)) return res.status(400)…`; wrap in `asyncHandler`; broaden parser to `type: () => true`; move mount below the rate limiter | **S** |
| P0-2 | **WhatsApp webhook has no authentication** | `routes/whatsapp.ts:40` — no `requireAuth`, no signature; zero matches for `x-hub-signature` repo-wide; reaches LLM executor that deletes data; auto-creates users at `services/whatsapp.ts:124-129` | Mount `express.raw` for that path, verify `X-Hub-Signature-256` using the proven pattern at `subscription.ts:83-91`; reject unknown numbers; meter via `tryConsumeAiCall` | **M** |
| P0-3 | **LLM-supplied `clientId` trusted verbatim — cross-tenant write/delete** | `services/voiceExecutor.ts:174-175` returns `action.clientId` with no ownership check; `clientId` is an LLM-fillable parameter. HTTP path does this correctly, voice/chat does not | Replace with `trainerClientModel.isClientOfTrainer(trainerId, clientId)` (`models/trainerClient.ts:53`); gate trainer tools behind a trainer-role check | **M** |
| P0-4 | **Paying customer charged, never granted Pro, silently** | `services/subscription.ts:130-138` `UPDATE … WHERE lemon_squeezy_customer_id = $5` — `rowCount` never checked (`grep rowCount backend/src/services/` → nothing); that column is written in exactly one branch (`:197-200`) | Return and assert `rowCount`; treat 0 as error and rethrow so LS retries; add `custom_data.user_id → customer_id → email` fallback resolution | **M** |
| P0-5 | **iOS/Android rejection: external checkout, no IAP** | `capacitor.config.ts` with `ios`+`android`; zero hits for `revenuecat\|storekit\|play.?billing` across `frontend/`, `mobile/`, `twa/` | Adopt RevenueCat; branch `useSubscription.ts` on `Capacitor.isNativePlatform()`; store-localized prices in `Pricing.tsx` | **XL** |
| P0-6 | **No in-app account deletion** (Guideline 5.1.1(v) + GDPR Art. 17) | Zero hits for `delete.?account\|/api/users/me`; only `users.ts:229` (admin-only), which refuses self-delete at `:120-122` | Add `DELETE /api/users/me` with re-auth; note `food_entries`, `workouts`, `goals`, `daily_check_ins` lack `ON DELETE CASCADE` and need explicit deletion | **M** |
| P0-7 | **"Clear All Data" lies** | `pages/Settings.tsx:76-84` promises "All workouts, food entries… permanently deleted"; `handleClearData` (`:28-35`) only calls `storage.clear()` | Immediate: rewrite the copy to say "clear local cache". Then wire it to P0-6's real endpoint | **S** |
| P0-8 | **Onboarding never computes a calorie target** | `SetupWizard.tsx:21-28,47-62` collects every TDEE input; no BMR/TDEE/Mifflin code exists repo-wide; `useMacroGoals.ts:10` defaults carbs 300/fat 80/protein 120 → **2,400 kcal** for everyone | Compute Mifflin-St Jeor × activity factor at wizard finish, write `macroCarbs/Fat/Protein` via the existing `PUT /api/profile` (round to int per `routeSchemas.ts:152-155`) | **M** |
| P0-9 | **35 stale E2E specs + no CI job to catch them** | Removed routes and pre-redesign headings; neither workflow in `.github/workflows/` mentions playwright | Repair headings/routes, build a real auth fixture, add a chromium Playwright job to `ci.yml` | **L** |
| P0-10 | **Zero integration tests touch a real Postgres** | No matches for `DATABASE_URL\|testcontainer\|pg-mem` in any `*.test.ts`; `src/db/transaction.ts` 0%, `src/models` 30% | Add a pg-backed integration harness; CI already provisions pgvector for the migrations job — reuse it | **L** |

---

## 5. P1 — High impact (next 4–6 weeks)

**Billing correctness**
- Enforce `subscription_current_period_end` — it is stored but never read for entitlement, so a lost
  webhook means permanent free Pro (`services/aiQuota.ts:11,46`).
- Add webhook idempotency/ordering (`subscription_events` table, `ON CONFLICT DO NOTHING`) and handle
  `order_refunded`, `subscription_cancelled`, `subscription_expired` — all currently dropped.
- Fix `handleWebhookEvent` writing `payload.data.id` into `users.subscription_id` on *every* event
  without checking `payload.data.type` (`subscription.ts:204,223,235,246`) — on renewals this
  overwrites the subscription id with an invoice id.
- Server-side trial eligibility: add `trial_used_at`, ignore the client's `req.body.trial`
  (`routes/subscription.ts:20`).
- Block double-checkout: `routes/subscription.ts:14` never checks existing subscription state → 409.
- Grace period + dunning: `past_due` is an instant cutoff (`subscription.ts:231-241`); wire
  `lib/email.ts` for payment-failed, receipt, and cancellation.
- Cap and transactionalize the trainer cascade (`subscription.ts:153-179`) — currently an unbounded
  sequential `UPDATE` loop with no seat limit and no rollback, inside a webhook.

**Security**
- Revoke sessions on password reset — `middleware/auth.ts:31` claims it happens; `services/auth.ts:549-583`
  doesn't do it. Add `token_version` claim.
- Rate-limit `reset-password` and `exchange` (`app.ts:124-129` omits both); move `monitoringRouter`
  (`app.ts:121`) below the limiter; add `requirePro` to `routes/search.ts:10` (unmetered Gemini spend).

**Reliability / performance**
- `.catch()` the floating `publishEvent` at `services/foodEntry.ts:93` (crashes the process on a
  Redis blip) and soften `index.ts:137-140` to log-and-drain.
- Rewrite `models/streak.ts:37-99` as a single `INSERT … ON CONFLICT` — currently a non-atomic
  read-then-write that also destroys a streak when a past workout is backfilled.
- Paginate `chatAgent.ts:27,36,61,87` — it loads a user's entire history per tool call.
- Batch `copy_food_entries` (`chatAgent.ts:67-80`) — N+1 inserts + N Gemini embedding calls.
- Add the missing food-search indexes (`models/foodSearch.ts:311-323` has no usable index for its
  dominant predicates; the query silently degrades through two fallback tiers).
- Ship the `push_subscriptions` migration — the table exists only in dev-only `db/schema.ts`.

**Frontend**
- `viewport-fit=cover` in `index.html:7` — without it every `safe-area-inset` in the app is 0 on
  notched iPhones.
- Point `QuickVoiceEntry.tsx` / `BulkFoodEntryModal.tsx` at `hooks/useSpeechRecognition` — they use
  the Web Speech API, which does not exist in the iOS Capacitor WebView.
- Fix 4 `invalidateQueries` keys that match nothing (`AiChatPanel.tsx:54,57,58`, `useAgent.ts:105,106`)
  and invalidate streaks on log.
- Add `onError` to every mutation in `useWorkouts/useEnergy/useWeight/useWater/useGoals` — success
  toasts currently fire before the server confirms.
- Render error states — only `Goals.tsx` consumes the error its hook already computes.
- Lazy-load `BarcodeScanner` — `html5-qrcode` is 108 KB gzip of the 306 KB entry chunk, shipped to
  every user before login.

**Process**
- Add ESLint + Prettier. There is none anywhere; `npm run lint` is `tsc --noEmit`, so CI's two "Lint"
  steps are duplicate typechecks. `no-floating-promises` alone would have caught P1's crash bug.
- Un-neuter the CI gates: drop `continue-on-error` at `ci.yml:115`, raise to `--audit-level=high`,
  promote Lighthouse assertions from `warn` to `error`.

---

## 6. P2 — Strategic (quarter horizon)

- **Consolidate the forked design system.** Two competing systems (shadcn/Fraunces vs `PulseUI`) are
  used side-by-side in the same file (`pages/Energy.tsx:407-424`). 404 arbitrary-value utilities,
  13 distinct `text-[Npx]` sizes. Adopt PulseUI as the product system; move radii/sizes into
  `tailwind.config.js`.
- **Fix accessibility contrast.** Ten semantic tokens fail WCAG AA, including `--muted-foreground`
  at 3.49:1 — which carries every portion size and unit label — and borders at 1.29:1.
- **Touch targets.** Every shadcn control is 36 px (`ui/button.tsx:23-28`, `input.tsx:14`,
  `select.tsx:21`); the dialog close button's hit area is 16 px.
- **Deploy pipeline.** No deploy job, no IaC, no tags, no rollback path
  (`docs/WORKFLOW.md:7`: "No deploy jobs yet"). Commit `railway.json`, add a gated deploy job, cut
  `v1.0.0`, write a runbook.
- **Stop auto-migrating on boot.** `backend/Dockerfile:34` runs migrations on every replica start
  with `--no-check-order` (`scripts/migrate-up.cjs:43`), contradicting `docs/RUNNING-RAILWAY.md:78`.
- **Error tracking.** Logging exists; alerting does not. Point an uptime monitor at `/ready` (10
  minutes of work) and add Sentry.
- **Mobile release engineering.** `frontend/ios/` does not exist despite four `cap:ios` scripts;
  Android is hardcoded at `versionCode 1` with no release signing.

---

## 7. Payments & monetization

### 7.1 Current state

Lemon Squeezy is the only provider wired: config `backend/src/config/index.ts:66-70,141-145`,
service `services/subscription.ts`, routes `routes/subscription.ts`, webhook mount `app.ts:83-87`.
**`plan.md`'s Max/Hyp migration is 0% started** — no `MAX_*` env var, no `hypApi`, no callback route,
no `max_customer_id` column, prices still USD.

`requirePro` **is not a Pro gate.** It is a 10-call/month AI meter (`services/aiQuota.ts:9`) that
returns `{allowed: true, isPro: true}` for *every* user when `lemonSqueezyApiKey` is unset
(`aiQuota.ts:31-34`). Rotating that one env var simultaneously grants everyone unlimited Gemini and
silently stops all billing webhooks (`app.ts:84`).

### 7.2 The blocking problem

Apple Guideline 3.1.1 and Google Play Billing both require in-app purchase for digital
subscriptions. `Pricing.tsx`, `UpgradePrompt.tsx` and `SubscriptionSection.tsx` all push users to a
browser. **This blocks the entire mobile channel — where essentially all consumer fitness
subscription revenue lives.** `frontend/android/` already exists; `frontend/ios/` does not, so the
rejection is certain on first iOS submission rather than imminent today.

### 7.3 Recommended architecture

```
                 ┌── native (Capacitor) ──► RevenueCat ──► StoreKit 2 / Play Billing
useSubscription ─┤                              │
                 └── web ──────────────────► Lemon Squeezy
                                                │
                              server: RevenueCat webhook + LS webhook
                                                ▼
                              users.subscription_status  (single entitlement source)
```

Use RevenueCat rather than raw StoreKit/Play Billing: one webhook shape, receipt validation and
cross-platform entitlement reconciliation are the parts that are expensive to build and dangerous to
get wrong.

### 7.4 On `plan.md` (Max/Hyp)

**Do not execute `plan.md` as written.** Two defects:

1. `plan.md:19` grants entitlement from redirect callback params. Redirect params are attacker-
   controlled — this creates a forged-callback Pro-grant vulnerability. Entitlement must come only
   from a server-to-server verification keyed on `uniqueID` with `responseMac` recomputed server-side.
2. `plan.md:50,63` delete the only cancellation path with no replacement, contradicting
   `Terms.tsx` §5.

Also note the strategic trade: Lemon Squeezy is a **merchant of record** — it remits VAT and issues
invoices. Hyp is a raw gateway that does neither, so an Israeli-VAT invoicing obligation lands on
you. Recommendation: **keep Lemon Squeezy for web, add RevenueCat for native, and shelve the Hyp
migration** unless the 1.9% fee saving is quantified against building MoR compliance in-house.

### 7.5 Entitlement matrix (target)

| Capability | Free | Pro | Trainer | Enforcement point |
|---|---|---|---|---|
| Manual food/workout logging | ✅ | ✅ | ✅ | none needed |
| Voice logging | 10 AI calls/mo | unlimited | unlimited | `requirePro` → rename `meterAiCall` |
| AI chat / insights | metered | unlimited | unlimited | `requirePro` |
| Semantic search | ❌ *(currently ungated)* | ✅ | ✅ | **add to `routes/search.ts:10`** |
| Client roster | — | — | seat-capped | `canAddClient` — **currently never called** |
| Period-end enforcement | — | required | required | **add to `aiQuota.ts`** |

---

## 8. Testing plan

Current: 21.91% backend / 25.28% frontend statements, 396 passing tests, **zero** integration or
working E2E coverage.

### Layer 1 — Integration against real Postgres (highest value, currently absent)
Reuse the pgvector service already in `ci.yml`'s `migrations` job.
Targets in order: `models/foodSearch.ts` (pgvector + the trigram indexes), `models/foodEntry.ts`
(`meal_type`), `models/streak.ts` (the `ON CONFLICT` rewrite), `models/trainerClient.ts` (0%,
authorization boundary), `db/transaction.ts` (0%).
Seed the harness with the conditional-mount config from `routes/index.ts:39-45` unset, or specs will
exercise a different router topology than production.

### Layer 2 — Unit, security-critical zero-coverage
- `services/auth.ts` — 639 lines, **0%**; `routes/auth.test.ts:24-39` `vi.mock`s the entire service
  it claims to test. Largest concentration of untested security logic in the repo.
- `routes/subscription.test.ts` — supertest against `createApp()`, mirroring `auth.test.ts`. Must
  include a `Content-Type: text/plain` case asserting **the process is still alive** (P0-1 regression
  test).
- `services/aiQuota.ts` — 0%, the entire free-tier gate.
- `middleware/auth.ts:83-104` `resolveTrainerClientUserId` — the actual trainer authorization guard.
- `lib/voiceActionExecutor.ts` — 459 lines, 0%, cheapest high-value frontend win.

> Note: `services/subscription.test.ts:86-210` already covers `handleWebhookEvent`'s event
> transitions. Don't re-test those — target `getPlanFromVariantId` and the zero-coverage route file.

### Layer 3 — E2E journeys
Repair the 3 stale specs (headings + routes only), then build `e2e/fixtures/auth.setup.ts` with a
real login + `storageState` — this fixture is the actual blocker, since `dashboard.spec.ts:12-39`
currently injects a fake token and asserts nothing real. Then add journeys, in order:
food logging (manual), food logging (voice), workout logging, subscription checkout, trainer→client.

### Layer 4 — CI enforcement
- Add a chromium Playwright job to **`ci.yml`** (not `pwa-checks.yml`, whose `Dev` branch trigger is
  dead). Nightly for firefox/webkit. Upload `playwright-report`.
- Fix `frontend/package.json`: `"test": "vitest"` and `"test:coverage": "vitest --coverage"` both
  hang in watch mode — add `--run`.
- Coverage ratchet, set at measured baselines so it passes on first commit:
  backend 21% stmts / 17% branches; frontend 25% stmts / **19%** branches (not 20 — only 0.39pt of
  headroom would flake).

### Layer 5 — Missing types
Contract tests for the API, a migration-vs-`schema.ts` drift guard (would have caught
`push_subscriptions`), a11y tests, and Capacitor smoke tests.

---

## 9. Structure & repo hygiene

**Git weight.** `size-pack: 33.70 MiB` for ~4 MB of source. `beme_ytp.mp4` (17.4 MB),
`beme_demo.mp4` (2.3 MB), nine `design-mockups/*.png` (~9 MB), `FoodData_Central_*.json` (6.8 MB).
Every clone and all 8 CI jobs pay this on every push.

> **Deleting the files in a new commit does nothing** — the blobs stay reachable. They sit in a root
> commit, so only a history rewrite fixes it:
> `git filter-repo --path beme_ytp.mp4 --path beme_demo.mp4 --path generate_ytp_video.py --path generate_demo_video.py --invert-paths`
> With ~100 commits and effectively one contributor, this is cheap now and never gets cheaper.
> Move videos to release assets; fetch the USDA dump at seed time instead of committing it.

**Dead weight to resolve:** `TrackVibe/`, `langchain-prototype/`, `twa/`, `money-service.js` and
`schedule-service.js` (the frontend has no Money or Schedule pages), `backend/prisma/` alongside raw
`pg`. Decide per directory: delete, or document why it stays.

**Consistency:** one lint/format config at the root; align the Android package path
(`com/bme/app` → `com/trackvibe`); either run `cap:add:ios` and commit `frontend/ios/`, or drop
`@capacitor/ios` and the four `cap:ios*` scripts so the repo stops advertising what it lacks.

---

## 10. Feature roadmap — top 10

Ranked by retention impact per unit of effort. Logging friction and day-1→day-7 habit formation
drive retention in this category; the list is weighted accordingly.

| # | Feature | Why it matters | Effort | Sketch |
|---|---|---|---|---|
| 1 | **TDEE-derived calorie & macro targets** | The number the entire product is organized around is currently a constant | M | Mifflin-St Jeor × activity factor at `SetupWizard` finish → existing `PUT /api/profile` |
| 2 | **Recent / frequent / favorite foods** | Highest-frequency friction; today every log needs a fresh search or a *metered* voice call | M | New route on `routes/foodEntry.ts`; `models/foodEntry.ts:77-96` `findOne` is the pattern to copy |
| 3 | **Saved meals / templates + "Copy yesterday"** | Zero `meal_template` hits repo-wide; only whole-day duplication exists | M | New table + `log_saved_meal` tool in `services/chatAgent.ts`; fan out via existing `POST /food-entries/batch` |
| 4 | **Make one voice utterance cost one quota unit** | Post-voice `lookupOrCreateFood` fan-out means a free user gets ~2–3 voice meals *ever* | S | Resolve nutrition inside `/api/voice/understand`, or exempt the fan-out; drop `requirePro` from `insights.ts:15` freshness |
| 5 | **PR detection, 1RM, per-exercise progression** | Users enter per-set weight × reps — the highest-effort input in the app — and get one line back | M | Pure client-side over `GET /api/workouts`; Recharts already in use |
| 6 | **Server-side workout routines** | Routines are localStorage-only (`WorkoutModal.tsx:701`) and evictable in a Capacitor WebView | M | Persist templates; surface on the Workouts page; `previousByName:574-586` already builds the prefill map |
| 7 | **Scheduled & re-engagement notifications** | Client-side reminders exist but need the app open; server push is only echoes of just-completed actions | L | Persist the existing `NotificationContext` shape server-side; BullMQ repeatable job; add `body.StreakMilestone` to `pushNotifier.ts` |
| 8 | **Account deletion + data export** | Two publish blockers plus GDPR Art. 15/17/20 | M | `DELETE /api/users/me`, `GET /api/profile/export`. A client-side export already exists at `DataManagementSection.tsx:19-37` — server-side supersedes it |
| 9 | **Apple Health / Health Connect sync** | Table stakes for the stated competitor set; unlocks weight/steps without manual entry | L | Capacitor plugin + a sync service |
| 10 | **Onboarding polish + skeletons + error states** | First-run quality is what separates "product" from "prototype" | M | Ties into P1 frontend items |

---

## 11. 90-day sequenced roadmap

| Sprint | Theme | Lands |
|---|---|---|
| **1** (wk 1–2) | Stop the bleeding | P0-1 DoS, P0-2 WhatsApp auth, P0-3 clientId, P0-4 zero-row entitlement; ESLint/Prettier; un-neuter CI gates; `subscription.test.ts` incl. DoS regression |
| **2** (wk 3–4) | Test foundation | Postgres integration harness; `services/auth.ts` + `aiQuota.ts` tests; repair 35 E2E specs + auth fixture; Playwright job in CI; coverage ratchet |
| **3** (wk 5–6) | Billing correctness | Period-end enforcement, idempotency table, refund/cancel events, `data.type` validation, server-side trials, double-checkout 409, grace period + dunning emails |
| **4** (wk 7–8) | Store readiness | RevenueCat native purchases; account deletion + export; fix "Clear All Data"; `cap:add:ios`; Android signing + versionCode |
| **5** (wk 9–10) | Product core | TDEE targets; recent/frequent foods; saved meals; one-unit voice quota; PR/1RM tracking |
| **6** (wk 11–12) | Polish & ops | Design system consolidation; WCAG contrast; touch targets; deploy job + IaC + runbook; Sentry + uptime; git history rewrite |

---

## 12. Quick wins

Each under a day.

- [ ] `Buffer.isBuffer` guard in `routes/subscription.ts` — closes the full-API DoS (**~5 lines**)
- [ ] `.catch()` on `services/foodEntry.ts:93` — closes the second process-kill path
- [ ] `viewport-fit=cover` in `index.html:7` — activates every safe-area inset in the app
- [ ] Lazy-load `BarcodeScanner` in `FoodEntryModal.tsx:9` — **−108 KB gzip** off the entry chunk
- [ ] Fix 4 dead `invalidateQueries` keys + invalidate streaks
- [ ] Rewrite the "Clear All Data" dialog copy so it stops lying
- [ ] `--run` in `frontend/package.json` test scripts so coverage can run in CI
- [ ] Drop `continue-on-error` at `ci.yml:115`; `--audit-level=high`
- [ ] `app.use('/api/auth/reset-password', authLimiter)` + `exchange`
- [ ] `requirePro` on `routes/search.ts:10` — stops unmetered Gemini spend
- [ ] `push_subscriptions` migration — un-breaks web push on fresh databases
- [ ] Food-search GIN indexes on `lower(COALESCE(common_name, name))` and `search_aliases`
- [ ] Point an uptime monitor at `GET /ready`
- [ ] Bump shadcn control heights to `h-11` (`button.tsx`, `input.tsx`, `select.tsx`)

---

### Method note

Findings were produced by seven parallel dimension audits, then each was re-checked by an
independent adversarial verifier that opened the cited files. 129 findings survived; 1 was refuted
outright and 28 were corrected in evidence or severity. Where a verifier disagreed with an auditor,
the verifier's corrected facts are what appear above. Notable corrections folded in: a client-side
data export *does* exist; `handleWebhookEvent` event transitions *are* already tested;
`idempotencyMiddleware` is on four routes, not two; client-side daily reminders *do* exist; and the
default calorie goal is **2,400**, not 2,360 as first reported.
