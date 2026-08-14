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

Every radius derives from `--radius` (0.875rem), so the scale moves as one:

| token | value |
|---|---|
| `rounded-sm` | 10px |
| `rounded-md` | 12px |
| `rounded-lg` | 14px |
| `rounded-xl` | 18px |
| `rounded-2xl` | 22px |
| `rounded-3xl` | 30px |

Cards use `rounded-2xl` or larger. Never write a bracket value — `rounded-[22px]` is
`rounded-2xl`, and a radius that isn't on the scale is a new scale step, not a one-off.

Pick by element size, not just by role: at 18px, `rounded-xl` is half the height of a 36px
control, so a small icon button rendered with it is a circle. Below ~44px, use `rounded-md`
or `rounded-full` and mean it.

- Prefer an existing `components/ui/` primitive (shadcn) over a new styled div.
- New colors go in `index.css` as tokens first, then get used — a one-off color in a component is a bug.
