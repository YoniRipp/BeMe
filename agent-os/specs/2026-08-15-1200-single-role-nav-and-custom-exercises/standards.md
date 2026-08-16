# Standards That Apply

| Standard | Why it applies here |
|---|---|
| `backend/routes` | A new `POST /api/exercises`; trainer routes come out of `routes/index.ts` |
| `backend/api-layers` | The create path gets its own controller + service rather than SQL in the route |
| `backend/response-format` | `sendCreated` for the new exercise, `sendJson` for reads |
| `backend/errors` | Duplicate name resolves to the existing row; validation errors via Zod |
| `backend/models` | All SQL stays in `models/exercise.ts` |
| `backend/data-lifecycle` | Why custom exercises go in the shared catalog and not a per-user table |
| `frontend/data-fetching` | `createExercise` updates the catalog cache with `setQueryData`, no invalidate |
| `frontend/api-client` | The picker's catalog fetch moves behind `core/api/exercises.ts` |
| `frontend/components` | The create form is a section of the existing sheet, not a new primitive |
| `frontend/design-tokens` | The colour pass — tokens only, no hexes, no raw palette classes |
| `frontend/mobile-ui` | Four-tab bar, 44px touch targets in the create form |
| `global/critical-rules` | Nav is a large UI change: analyse, name the problem, then change |
| `global/testing` | Nav, picker and role tests move with the code they cover |

## Key points carried into the work

- **Four layers, never skipped** — `routes/ → controllers/ → services/ → models/`. Controllers
  never touch `getPool()`; services never touch `req`/`res`.
- **No success envelope.** `sendCreated(res, exercise)` returns the resource bare.
- **`getEffectiveUserId(req)`, never `req.user.id`** — the admin `?userId=` override still
  rides on it after the trainer branch is deleted.
- **Query keys come from `queryKeys`** in `lib/queryClient.ts`; `staleTime` is always explicit.
- **Mutations write the cache directly**, so the picker list doesn't flash a spinner after a
  create.
- **New colours are tokens first.** A one-off colour in a component is a bug.
- **Per-user data must stay bounded** — which is the argument for a shared catalog row over a
  per-user custom-exercise table.
</content>
