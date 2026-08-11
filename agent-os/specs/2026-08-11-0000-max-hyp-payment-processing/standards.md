# Standards for Max/Hyp Payment Processing

The following standards apply to this work. Full text lives in `agent-os/standards/`.

---

## backend/api-layers

@agent-os/standards/backend/api-layers.md

The Hyp XML client is service-layer code. Controllers stay thin: read `getEffectiveUserId(req)`, call one service function, send via a `utils/response.js` helper. No gateway calls or XML parsing in a controller.

---

## backend/routes

@agent-os/standards/backend/routes.md

`GET /api/subscription/callback` is hit by Hyp's redirect, not by our frontend — it carries query params, not a JSON body. Validate those params with a Zod schema before touching subscription state. Middleware order still applies to the rest of the router.

---

## backend/errors

@agent-os/standards/backend/errors.md

Gateway failures throw typed errors: a rejected card or bad MAC is `ValidationError`, an unreachable gateway is `ServiceUnavailableError`. Never surface a raw Hyp status code to the client.

---

## backend/models

@agent-os/standards/backend/models.md

The `lemon_squeezy_customer_id` → `max_customer_id` rename needs a `node-pg-migrate` migration plus an updated `RETURNING` const and `rowToX` mapper in the subscription model.

---

## global/critical-rules

@agent-os/standards/global/critical-rules.md

Subscription state is live. Existing Pro users must not lose access during the swap — plan the column migration and the `requirePro` gate change so there is no window where both gateways are unconfigured.
