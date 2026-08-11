# API Layering

Every domain flows through four layers. Never skip one.

```
routes/ → controllers/ → services/ → models/ → db
```

- **routes/** — path + middleware only. No logic.
- **controllers/** — thin HTTP adapter. Wrap in `asyncHandler`, read user via `getEffectiveUserId(req)`, call one service, send via a `utils/response.js` helper.
- **services/** — business logic. Throws domain errors, publishes events. Trusts Zod-validated input from the route layer.
- **models/** — typed data access. SQL lives here and nowhere else.

```ts
// controllers/goal.ts — the whole shape of a controller
export const add = asyncHandler(async (req: Request, res: Response) => {
  const userId = getEffectiveUserId(req);
  const item = await goalService.create(userId, req.body);
  sendCreated(res, item);
});
```

- Controllers never touch `getPool()` or write SQL.
- Services never touch `req`/`res`.
- Always `getEffectiveUserId(req)`, never `req.user.id` — admins and trainers act on behalf of other users, and `req.user.id` silently breaks that.
