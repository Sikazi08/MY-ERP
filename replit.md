# THE HOMIES ERP

ERP complet pour une boutique de téléphones et accessoires en Afrique de l'Ouest.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080)
- `pnpm --filter @workspace/homies-erp run dev` — run the frontend (port 25438)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL`, `SESSION_SECRET`

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite + Tailwind CSS v4 (dark theme)
- API: Express 5, session-based auth (connect-pg-simple)
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/homies-erp/` — React frontend
- `artifacts/api-server/` — Express API server
- `lib/db/src/schema/` — Drizzle ORM schemas (users, products, sales, partners, expenses, clients, movements)
- `lib/api-spec/` — OpenAPI spec (source of truth for API contract)
- `lib/api-client-react/src/generated/` — Generated React Query hooks + Zod schemas

## Architecture decisions

- Contract-first API: OpenAPI spec → Orval codegen → typed React Query hooks used everywhere in frontend
- Session-based auth (not JWT) stored in PostgreSQL `session` table (connect-pg-simple)
- Role system: `admin` (full access) vs `secretary` (restricted — no purchasePrice/profit, no clients, no stats)
- Tailwind CSS v4 with always-dark theme (no dark mode toggle; all vars in `:root`)
- Product IDs auto-generated in `THXXX` format; IMEI tracked per unit

## Product

- **Stock**: IMEI-tracked phone/accessories inventory with purchase/selling prices
- **Ventes**: Sales recording (normal + troc/barter), linked to clients and partners
- **Partenaires**: Partner shop management for phone consignment
- **Dépenses**: Business expense tracking by category
- **Clients**: Customer CRM with purchase history (admin only)
- **Mouvements**: Full movement journal (entries, sales, transfers, returns)
- **Statistiques**: Financial KPIs, charts, top performers (admin only)
- **Utilisateurs**: User management (admin only)
- **Exports**: Excel exports for all major datasets

## User credentials (development)

- Admin: `admin` / `admin123`
- Secretary: `secretaire` / `admin123`

## Gotchas

- The `session` table must exist in PostgreSQL before the API server starts. It was manually created (connect-pg-simple's `createTableIfMissing` didn't auto-run before first login attempt).
- Tailwind v4: `dark` is a custom variant, NOT a utility class. Never use `@apply dark` in CSS.
- Wouter v3: `Route` uses `component` prop, NOT `render` prop.
- Password hashes must be generated with bcryptjs v3 (installed version) — v2 hashes are NOT compatible.
- Session cookies work in the browser. When testing via curl, use a proper cookie jar (`-c`/`-b` flags).

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details

## User preferences

- French language throughout (all UI labels, error messages, toasts)
- FCFA currency formatting
- Dark UI: black background (#0f0f0f), dark gray cards (#1a1a1a), orange accent (#f97316)
