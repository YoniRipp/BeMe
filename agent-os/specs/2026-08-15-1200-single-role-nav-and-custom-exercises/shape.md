# Single Role, New Bottom Nav, Custom Exercises — Shaping Notes

## Scope

Three changes, requested together because they all narrow the app back to one kind of user
doing one kind of thing: tracking their own training and food.

1. **Trainer permissions go away.** Everyone is a normal user. With no trainers there are no
   clients, so the whole client-roster surface — the page, the invitations, the voice
   "log this for Guy" actions, the trainer-scoped API — comes out.
2. **Bottom navigation becomes Home · Workouts · Food · Profile.** Goals leaves the bar (it
   stays reachable from the sidebar/drawer); Clients is gone with the trainer role.
3. **A custom exercise can be added from the picker** when a movement isn't in the catalog.
   It is written to the shared `exercises` table, so every user gets it, not just the author.

Plus a colour pass over the palette (see Decisions).

## Decisions

### Trainer removal

- **Remove the code, keep the data.** `trainer_clients` and `trainer_invitations` are left
  in place — dropping them is irreversible and nothing reads them any more. The migration
  normalises roles and tightens the constraint; the tables stay for the owner to drop later.
  Both bootstrap paths (`db/schema.ts` and `migrations/`) keep creating them so they stay in
  sync, marked legacy.
- **Nobody loses their subscription.** `subscription_status` values `trainer` and
  `trainer_pro` migrate to `pro`, and `subscription_source = 'trainer'` grants are left
  untouched. A user whose Pro came from a trainer keeps their Pro.
- **`requireTrainer` and `resolveTrainerClientUserId` go, `getEffectiveUserId` stays.** The
  admin `?userId=` override still needs `req.effectiveUserId`, so the middleware plumbing
  survives — only the trainer branch is deleted.
- **The six `*_client_*` voice actions go with it.** They existed only so a trainer could
  dictate into someone else's log; with no roster to resolve against, they can only fail.
- **Admin keeps its user table, loses its trainer CRM widgets.** The role picker drops
  `trainer`, and the four trainer metrics leave the business overview and the growth chart,
  because their source of truth no longer exists as a concept.

### Bottom navigation

- **Four tabs, no more role branching.** One constant, not two arrays plus a predicate.
- **Profile points at `/settings`.** That page already opens with a `Profile` kicker and
  owns `ProfileSection` — a second page would split the same content.
- **Food is `/energy`.** The route keeps its name; only the label changes, so no bookmarks,
  no deep links and no tests break on a path rename.
- **Goals stays a page.** It leaves the tab bar, not the app: still in the sidebar nav and
  still routed.

### Custom exercises

- **Global catalog, not a per-user table.** The user asked for exercises everyone can use,
  and it also keeps the data bounded — a per-user exercise table would need its own
  compaction story (`backend/data-lifecycle`), a shared catalog does not.
- **`is_custom` marks user-contributed rows** so the seeded catalog stays distinguishable
  and the picker can label them. `created_by` already exists on the table.
- **Duplicate names resolve to the existing row.** `name` is uniquely indexed; the insert
  uses `ON CONFLICT (name) DO NOTHING` and then re-reads case-insensitively, so someone
  typing "bench press" gets handed the catalog's "Bench Press" instead of an error.
- **No moderation queue.** Rows are live immediately, as asked. Admin already has exercise
  edit/delete for cleanup.

### Colour

The palette was consolidated in the 2026-08-14 spec, so there are no raw Tailwind colour
classes or stray hexes left to sweep. Rather than restyle on taste, every token was
measured against the surface it actually sits on. Two things came back wrong:

- **`--muted-foreground` fails AA in both themes.** It is the app's most-used text colour —
  11px nav labels, card sublines, form hints, all small text needing 4.5:1 — and it
  measured 3.70:1 on a light card and 4.26:1 on a dark one. Retuned to 5.31:1 / 6.77:1.
- **The dark accents never got the Phase 3 treatment sage did.** Terracotta, gold and info
  sat at 100% saturation and had drifted 4–6° off their light-mode hues, so the dark theme
  read as a louder, different palette beside a 45%-saturated sage. Pulled back onto the
  light hues and off full chroma.

**Light `--primary` was deliberately left alone.** The obvious-looking change — pointing it
at the brand `--sage` instead of the deeper `--sage-dark` — would have taken `text-primary`
from 6.58:1 to about 4.0:1 and failed AA. The muddiness is the cost of a sage that has to
carry text.

## Constraints

- `frontend/` is the only shipping client; `mobile/` is dormant and deliberately untouched.
- The MCP server consumes the same API — it exposes no trainer tools, so nothing there
  breaks, but `GET /api/exercises` had to stay shape-compatible (the new field is additive).
- The role check constraint lives in two places (`db/schema.ts` and a migration); both move.
</content>
</invoke>
