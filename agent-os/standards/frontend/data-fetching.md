# Data Fetching

All server state goes through TanStack Query. No `useEffect` + `fetch`.

The chain is: **`core/api/` client → `features/<domain>/api.ts` → `features/<domain>/mappers.ts` → `hooks/use<Domain>.ts` → component.**

```ts
const { data: goals = [] } = useQuery({
  queryKey: queryKeys.goals,          // always from @/lib/queryClient
  staleTime: 2 * 60 * 1000,           // always explicit
  queryFn: async () => (await goalsApi.list()).data.map(apiGoalToGoal),
});
```

- **Query keys are centralized.** Add to `queryKeys` in `lib/queryClient.ts`; never inline a string array.
- **Always set `staleTime`.** Omitting it makes the app refetch on every mount.
- **Mappers convert API → domain** (`apiGoalToGoal`): dates become `Date`, strings become union types. Components never see raw API shapes.
- **Mutations update the cache directly** with `setQueryData`, not `invalidateQueries` — the list stays put instead of flashing a spinner.

```ts
onSuccess: (created) => {
  queryClient.setQueryData(queryKeys.goals, (prev: Goal[] | undefined) =>
    prev ? [...prev, apiGoalToGoal(created)] : [apiGoalToGoal(created)]);
}
```

- **Hooks expose actions, not mutation objects.** Wrap in `useCallback` returning `Promise<void>`.
- **Hooks expose errors as display strings**, not `Error` objects: `error instanceof Error ? error.message : 'Could not load goals. Please try again.'`
