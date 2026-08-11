# Design Tokens

The palette is paper-warm neutrals with a single sage accent. Terracotta is **reserved for food/energy** — don't spend it as a generic accent.

Use Tailwind classes bound to CSS variables in `index.css`. Never hardcode a hex or arbitrary HSL.

| Role | Token |
|---|---|
| App background | `--paper` / `--paper-2` (muted sections) |
| Primary text | `--ink` |
| Secondary text | `--ink-2` |
| Captions / tertiary | `--ink-3` |
| Borders | `--hairline` (opaque, not a black alpha) |
| Brand accent | `--sage`, `--sage-light`, `--sage-dark` |
| Food / energy | `--terracotta` |
| Status | `--success`, `--gold` |

Type pair: **Fraunces** (display) + **Inter** (body).

## Elevation and radius

Shadows come from the scale, not ad-hoc values:

```
shadow-xs · shadow-card · shadow-card-md · shadow-card-lg
```

Radius derives from `--radius`: `rounded-sm|md|lg|2xl|3xl`. Cards use `rounded-2xl` or larger.

- Prefer an existing `components/ui/` primitive (shadcn) over a new styled div.
- New colors go in `index.css` as tokens first, then get used — a one-off color in a component is a bug.
