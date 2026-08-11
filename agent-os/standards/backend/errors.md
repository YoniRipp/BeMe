# Errors

Throw typed errors from `errors.js`. Never `res.status(...)` an error inside a service.

```ts
throw new NotFoundError('Goal not found');
throw new ValidationError('id is required');
```

Classes and their status codes:

| Class | Code | Status |
|---|---|---|
| `ValidationError` | `VALIDATION_ERROR` | 400 |
| `UnauthorizedError` | `UNAUTHORIZED` | 401 |
| `ForbiddenError` | `FORBIDDEN` | 403 |
| `NotFoundError` | `NOT_FOUND` | 404 |
| `ConflictError` | `CONFLICT` | 409 |
| `ServiceUnavailableError` | `SERVICE_UNAVAILABLE` | 503 |
| `AppError` | any `ErrorCode` | explicit |

`RATE_LIMITED` exists in the `ErrorCode` union with no dedicated class — raise it as `new AppError('RATE_LIMITED', 429, ...)`.

Use the subclass whenever one exists. Hand-rolling `new AppError('SERVICE_UNAVAILABLE', 503, ...)` when `ServiceUnavailableError` is right there is how the status/code pairing drifts.

- `asyncHandler` forwards throws to `errorHandler`, which maps them to the error envelope. That is the only place errors become HTTP.
- A model returning `null`/`false` means "not found" — the **service** converts it to `NotFoundError`, models never throw HTTP-shaped errors.
- Add new codes to the `ErrorCode` union in `errors.ts` first; the union is the contract.
