# Response Format

There is **no success envelope**. Success responses return the resource bare.

```ts
sendJson(res, item);        // 200, bare object/array
sendCreated(res, item);     // 201
sendNoContent(res);         // 204, empty body
```

Errors are the only wrapped shape:

```json
{ "error": { "code": "NOT_FOUND", "message": "Goal not found", "details": {} } }
```

List endpoints use `sendPaginated`, which adds its own envelope:

```json
{ "data": [], "total": 42, "limit": 20, "offset": 0, "hasMore": true }
```

- Import helpers from `utils/response.js`. Never call `res.json()` directly in a controller.
- Don't wrap success payloads in `{ success: true, data }` — the frontend reads the resource directly.
- `details` is omitted entirely when absent, not set to `null`.
