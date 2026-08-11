# API Client

All HTTP goes through `request<T>()` in `core/api/client.ts`. Never call `fetch` directly in a component, hook, or feature module.

```ts
export const goalsApi = {
  list: () => request<{ data: ApiGoal[] }>('/api/goals'),
  add: (body: CreateGoal) => request<ApiGoal>('/api/goals', { method: 'POST', body }),
};
```

What `request` already handles — don't reimplement any of it:

- **Auth** — bearer token in memory plus `credentials: 'include'` for cookie sessions. Tokens are never written to `localStorage`.
- **401** — clears auth state and dispatches `auth:logout`. Pass `suppressUnauthorizedEvent` only on probe calls like `/auth/me`.
- **Timeout** — 30s default via `AbortController`, surfaced as `Error('Request timed out')`.
- **Offline mutations** — when `PWA_OFFLINE_SYNC` is on, mutations are queued and replayed on reconnect. `request` returns the submitted body as an optimistic placeholder, so a resolved promise does **not** guarantee a server write.
- **Errors** — unwraps `{ error: { message } }` into a thrown `Error`. Callers catch `Error`, not response objects.
- **204** — returns `undefined`.

Feature API modules (`features/<domain>/api.ts`) declare the API's wire types; domain types live in `types/` and are produced by mappers.
