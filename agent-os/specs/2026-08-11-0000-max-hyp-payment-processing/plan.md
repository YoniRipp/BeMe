# Plan: Replace Lemon Squeezy with Max (Hyp/YaadPay) Payment Processing

## Overview
Replace the existing Lemon Squeezy subscription payment system with Max's payment clearing (סליקה) service via the Hyp (formerly CreditGuard/YaadPay) payment gateway. Max uses YaadPay/Hyp as the underlying gateway - terminals starting with "88" route to `pay.leumicard.co.il`.

## Pricing Model
- Commission: 1.9% per transaction (+ VAT), no monthly fees
- "If you don't clear, you don't pay" model

## Technical Approach

### Payment Flow
1. User clicks "Subscribe" on frontend
2. Backend creates a Hyp payment page request (XML `doDeal` command)
3. Hyp returns a hosted payment page URL (`mpiHostedPageUrl`)
4. Frontend redirects user to Hyp's hosted payment page
5. User enters credit card details and pays
6. Hyp redirects back to success/error URL with transaction details (query params)
7. Backend validates the transaction and activates the subscription

### Key Gateway Details
- **Endpoint**: Hyp XML API (HTTPS POST with XML body)
- **Auth**: `terminalNumber` (Masof) + `mid` (Merchant ID)
- **Card entry**: `CGMPI` (hosted payment page)
- **Response**: XML with `mpiHostedPageUrl` for redirect
- **Callback params**: `uniqueID`, `cgUid`, `cardToken`, `responseMac`, `authNumber`

## Implementation Steps

### Step 1: Update Backend Config
- Replace Lemon Squeezy env vars with Max/Hyp env vars:
  - `MAX_TERMINAL_NUMBER` (Masof number)
  - `MAX_MERCHANT_ID` (mid)
  - `MAX_API_PASSWORD` (for API authentication)
- Update Zod schema in `config/index.ts`

### Step 2: Replace Subscription Service
- Rewrite `services/subscription.ts`:
  - Replace `lsApi()` with `hypApi()` that sends XML requests to Hyp
  - `createCheckoutSession()` → creates Hyp payment page via `doDeal` XML command
  - `handlePaymentCallback()` → validates callback params and activates subscription
  - Keep `getUserSubscription()` and `updateSubscriptionStatus()` (DB logic stays the same)
  - Keep `cascadeTrainerRevocation()` (business logic unchanged)

### Step 3: Update Routes
- Rewrite `routes/subscription.ts`:
  - Keep `/api/subscription/checkout` → now returns Hyp payment page URL
  - Replace `/api/webhooks/lemonsqueezy` with `/api/subscription/callback` (GET) for Hyp redirect callback
  - Keep `/api/subscription/status`
  - Remove `/api/subscription/portal` (Max doesn't have a customer portal like Lemon Squeezy)

### Step 4: Update Middleware
- Update `requirePro.ts`: Change `lemonSqueezyApiKey` check to `maxTerminalNumber` check

### Step 5: Update DB Schema
- Rename `lemon_squeezy_customer_id` column to `max_customer_id` (or add new column)
- Add migration for the column rename

### Step 6: Update Frontend
- Update `core/api/subscription.ts`: Remove `createPortal` method
- Update `hooks/useSubscription.ts`: Remove `manage` function, keep subscribe flow (it's already redirect-based)
- Update `pages/Pricing.tsx`: Change prices from USD to ILS (₪)
- Update `components/settings/SubscriptionSection.tsx`: Remove "Manage Subscription" portal link
- Update `components/subscription/UpgradePrompt.tsx` if needed

### Step 7: Update app.ts
- Remove the Lemon Squeezy raw body parser middleware
- Remove webhook router
- Add callback route handling

## Environment Variables Required
```
MAX_TERMINAL_NUMBER=<your masof number>
MAX_MERCHANT_ID=<your merchant ID>
MAX_API_PASSWORD=<your API password>
```

## Notes
- Max/Hyp handles one-time payments natively. For recurring subscriptions, we would need to implement tokenization + scheduled charging, or simply have users re-subscribe when their period ends.
- The hosted payment page URL is valid for 10 minutes.
- PCI DSS Level 1 compliant - card data never touches our servers.
- Supports Visa, MasterCard, and Isracard.
