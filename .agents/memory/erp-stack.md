---
name: Homies ERP stack conventions
description: Key architectural decisions and conventions for the homies-erp project
---

## Stack
- pnpm monorepo: `artifacts/homies-erp` (React+Vite), `artifacts/api-server` (Express+esbuild), `lib/db` (Drizzle+pg), `lib/api-client-react` (Orval-generated)
- API server: port 8080, admin: admin/admin123
- Frontend Vite: dynamic PORT env var

## Critical conventions
- **DO NOT** add new React Query hooks to lib/api-client-react without regenerating via Orval. Use `useQuery` + raw `fetch` with `credentials: "include"` for new endpoints.
- DB schema: `lib/db/src/schema/`. Run `pnpm --filter @workspace/db run push` to push schema changes (but check if migrations exist first).
- Product types: 'téléphone' (IMEI, brand dropdown, qty=1) vs 'accessoire' (no IMEI, quantity required, no troc)
- Accessory stock logic: single row with quantity; selling decrements quantity; qty=0 → status=vendu
- Format utilities: `formatFCFA`, `formatDateFr` in `artifacts/homies-erp/src/lib/format.ts`; `formatFCFA_server` in `artifacts/api-server/src/utils/format.ts`

## Invoice
- `GET /api/sales/:id/invoice` returns full HTML page (printable, opens in new tab)
- No PDF library needed — browser print to PDF

## Stock import
- `POST /api/products/import` (admin only, multipart xlsx/csv)
- Column mapping: Produit, Type, Marque, IMEI, Capacité, Couleur, Fournisseur, Quantité, PV, PA, Date, Méthode
