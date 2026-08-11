# References for Max/Hyp Payment Processing

## Code being replaced

### Subscription service
- **Location:** `backend/src/services/subscription.ts`
- **Relevance:** Contains the Lemon Squeezy adapter (`lsApi()`) to be swapped for `hypApi()`
- **Key patterns:** Keep `getUserSubscription`, `updateSubscriptionStatus`, `cascadeTrainerRevocation` — they are gateway-agnostic

### Subscription routes
- **Location:** `backend/src/routes/subscription.ts`
- **Relevance:** `/checkout` changes return value, `/portal` is deleted, webhook becomes callback

### Pro gating
- **Location:** `backend/src/middleware/requirePro.ts`
- **Relevance:** Gates on `lemonSqueezyApiKey` being configured; must gate on `maxTerminalNumber`

### Config
- **Location:** `backend/src/config/index.ts`
- **Relevance:** Zod env schema — swap Lemon Squeezy vars for `MAX_TERMINAL_NUMBER`, `MAX_MERCHANT_ID`, `MAX_API_PASSWORD`

## Frontend surface

| File | Change |
|---|---|
| `frontend/src/core/api/subscription.ts` | Remove `createPortal` |
| `frontend/src/hooks/useSubscription.ts` | Remove `manage`; subscribe flow is already redirect-based |
| `frontend/src/pages/Pricing.tsx` | USD → ILS (₪) |
| `frontend/src/components/settings/SubscriptionSection.tsx` | Remove portal link |
| `frontend/src/components/subscription/UpgradePrompt.tsx` | Review for portal references |

## Patterns to follow

- **External API adapter in a service** — see how `services/` wraps Gemini for the voice pipeline; the Hyp XML client belongs at the same layer.
- **Raw body parsing** — `app.ts` has Lemon Squeezy-specific raw body middleware for webhook signature checks. The Hyp callback is a GET redirect, so this middleware is removed, not adapted.
- **Migrations** — `backend/migrations/` (`node-pg-migrate`) for the `lemon_squeezy_customer_id` → `max_customer_id` column change.
