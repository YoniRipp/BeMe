# Max (Hyp/YaadPay) Payment Processing — Shaping Notes

## Scope

Replace the Lemon Squeezy subscription system with Max's payment clearing (סליקה) via the Hyp gateway (formerly CreditGuard/YaadPay). Terminals starting with `88` route to `pay.leumicard.co.il`.

## Decisions

- **Hosted payment page, not embedded fields.** Card data never touches our servers (PCI DSS Level 1 stays the gateway's problem). Backend requests a page via the `doDeal` XML command, frontend redirects to `mpiHostedPageUrl`.
- **Callback replaces webhook.** Hyp redirects back with query params (`uniqueID`, `cgUid`, `cardToken`, `responseMac`, `authNumber`) instead of posting a webhook. `/api/webhooks/lemonsqueezy` becomes `GET /api/subscription/callback`.
- **No customer portal.** Max has no equivalent to Lemon Squeezy's portal, so `/api/subscription/portal` and the frontend "Manage Subscription" link are removed rather than reimplemented.
- **Recurring billing is unresolved.** Hyp handles one-time payments natively. Either tokenize + schedule charges, or have users re-subscribe at period end. Not decided in this spec.
- **Pricing moves USD → ILS (₪).**
- **DB logic stays.** `getUserSubscription`, `updateSubscriptionStatus`, and `cascadeTrainerRevocation` are unchanged — only the gateway adapter is replaced.

## Context

- **Visuals:** None
- **References:** See `references.md`
- **Product alignment:** Phase 2 on the roadmap. Commission model is 1.9% + VAT, no monthly fee.

## Constraints

- The hosted payment page URL expires after 10 minutes.
- Supports Visa, MasterCard, Isracard.

## Standards Applied

- `backend/api-layers` — the gateway adapter belongs in the service layer; routes stay thin
- `backend/routes` — the new callback route needs `validateBody`/query validation and correct middleware order
- `backend/errors` — gateway failures map to typed domain errors, not raw status codes
- `global/critical-rules` — subscription state is live; don't break existing Pro users mid-migration
