# Tech Stack

Same as the org standard in `agent-os/standards/global/tech-stack.md`, plus the deployment specifics below.

## Frontend

React 18 + TypeScript, Vite, Tailwind + shadcn/ui, TanStack Query, React Router. PWA with service worker and offline mutation queue.

## Backend

Node.js + Express, TypeScript (ESM), Zod validation, raw SQL over `pg`.

## Database

PostgreSQL (Supabase in current production), `node-pg-migrate` migrations, pgvector for food search embeddings.

## Other

- **AI** — Google Gemini (voice function calling, food lookup, insights)
- **Redis** — BullMQ voice queue, caching, job state
- **Food data** — curated DB + USDA FoodData Central + Open Food Facts (barcode)
- **Clients** — web PWA, Expo React Native (`mobile/`), TWA Android wrapper (`twa/`)
- **Hosting** — Railway + Supabase today; AWS is the documented target (`docs/architecture-target-aws.md`)
- **MCP** — project MCP server at `backend/mcp-server/`
