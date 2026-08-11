# Routes

A route file wires paths to middleware and controllers. Nothing else.

```ts
router.get('/api/goals', withUser, goalController.list);
router.post('/api/goals', withUser, idempotencyMiddleware, validateBody(createGoalSchema), goalController.add);
router.patch('/api/goals/:id', withUser, validateBody(updateGoalSchema), goalController.update);
router.delete('/api/goals/:id', withUser, goalController.remove);
```

Middleware order is fixed: `withUser` → `idempotencyMiddleware` → `validateBody` → controller.

- **`withUser`** (from `routes/helpers.js`) on every authenticated route — it resolves `req.effectiveUserId`.
- **`validateBody(schema)`** on every POST/PATCH. Schemas live in `schemas/routeSchemas.ts` and export their inferred body type (`CreateGoalBody`) for the service signature.
- **`idempotencyMiddleware`** on POSTs that create resources — voice and offline sync both retry.
- Full paths include the `/api` prefix in the route file; routers mount bare in `routes/index.ts`.

## Service-extraction flags

Domain routers mount conditionally so a context can be split into its own service without code changes:

```ts
if (!config.goalsServiceUrl) router.use(goalRouter);
```

When adding a router for an extractable context, follow this pattern — the gateway proxies to the remote service when the URL is set.
