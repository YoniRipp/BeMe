# Models (Data Access)

Raw SQL with `pg`. No ORM. Every model file follows the same skeleton.

```ts
const RETURNING = 'id, type, target, period, created_at';   // never SELECT *

function rowToGoal(row: Record<string, unknown>): Goal {     // snake_case → camelCase
  return { id: row.id as string, createdAt: String(row.created_at) };
}

export async function findByUserId(
  userId: string,
  pagination?: PaginationParams,
  client?: pg.Pool | pg.PoolClient,   // optional last param, always
): Promise<{ data: Goal[]; total: number }> {
  const db = client ?? getPool('goals');
  ...
}
```

- **`RETURNING` const** — one column list per file, shared by every query. No `SELECT *`.
- **`rowToX` mapper** — DB rows are snake_case, domain types are camelCase. Convert in the mapper, never leak a raw row upward.
- **Optional `client` param last** — lets callers compose queries in a transaction. Default to `getPool(context)`.
- **`getPool('<context>')`** — pass the bounded context name so the pool can be split per service later. Not `getPool()`.
- **Queries on user-owned tables filter by `user_id`** (goals, workouts, food_entries, …). Ownership is enforced in the WHERE clause, not in the service.
- **Shared catalog tables have no owner** — `exercises` and `foods` are global reference data with no `user_id` column. Don't add one to the WHERE clause; gate write access at the route with an admin check instead.
- Partial updates use `buildUpdateQuery` with an `UPDATE_SPEC`, not hand-built SET clauses.
- Parameterize everything (`$1`, `$2`). For LIKE, use `escapeLike.ts`.
