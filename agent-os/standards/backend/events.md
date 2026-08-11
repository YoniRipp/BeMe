# Domain Events

Publish from the **service** layer, after the write succeeds.

```ts
const goal = await goalModel.create({ ... });
await publishEvent('goals.GoalCreated', goal as unknown as Record<string, unknown>, userId);
return goal;
```

Type format: `<context>.<PascalCasePastTense>` — `goals.GoalCreated`, `body.WorkoutUpdated`, `energy.FoodEntryDeleted`.

Contexts: `identity`, `body`, `energy`, `goals`, `voice` (see `docs/bounded-contexts.md`).

`publishEvent` supplies the envelope — `eventId`, `timestamp`, `version`, `correlationId` from the request context. Don't build envelopes by hand.

## Cross-context rules

- **No sync HTTP writes between contexts.** A context publishes; interested contexts subscribe.
- **No cross-context DB access.** Read through the owning context's API or a read model.
- Event payloads are a **versioned public contract**. A breaking payload change needs a new version (`body.WorkoutCreated.v2`), not an edit in place.
- Deletes publish the id only: `publishEvent('goals.GoalDeleted', { id }, userId)`.
