# Threat Model

## Project Overview

THE HOMIES ERP is a public-facing web ERP for a phone and accessories shop. The production application is a pnpm monorepo with a React/Vite frontend in `artifacts/homies-erp` and an Express 5 API in `artifacts/api-server`, backed by PostgreSQL via Drizzle ORM in `lib/db`. Authentication is session-based with `express-session` and `connect-pg-simple`; users are either `admin` or `secretary`.

Production assumptions for future scans:
- Only the deployed ERP (`artifacts/homies-erp` + `artifacts/api-server`) is in scope.
- `artifacts/mockup-sandbox` is dev-only and should be ignored unless production reachability is proven.
- The deployment is public on Replit and TLS is handled by the platform.
- `NODE_ENV` can be assumed to be `production` in deployed environments.

## Assets

- **User accounts and sessions** — authenticated ERP access is guarded by server-side sessions that carry `userId` and `role`. Compromise allows impersonation and privileged business actions.
- **Business inventory and financial records** — products, sales, expenses, partner movements, invoices, and profit data drive shop operations and should not be tampered with or overexposed.
- **Customer and partner PII** — client names, phone numbers, sales history, and troc attachment documents (invoice, declaration, CNI) are sensitive and should only be accessible to authorized roles.
- **Application secrets** — database credentials and the session signing secret protect the integrity of the backend and all authenticated sessions.

## Trust Boundaries

- **Browser to API** — all client requests cross from an untrusted browser into the Express API; every protected route must enforce authentication and role-based authorization server-side.
- **API to PostgreSQL** — the API server has broad database access; injection or unsafe direct SQL would expose or tamper with the entire ERP dataset.
- **Authenticated to admin-only surfaces** — `secretary` users are intentionally restricted from some data and features (notably user management, stats, and client CRM), so role checks must be consistent across normal pages, exports, and auxiliary endpoints.
- **User-controlled content to server-rendered documents/files** — user-entered names, notes, upload metadata, and uploaded file contents flow into invoices, exports, and attachment download responses and must not become executable content.

## Scan Anchors

- Production backend entry points: `artifacts/api-server/src/index.ts`, `artifacts/api-server/src/app.ts`, `artifacts/api-server/src/routes/*.ts`
- Production frontend entry points: `artifacts/homies-erp/src/main.tsx`, `artifacts/homies-erp/src/App.tsx`
- Highest-risk areas: `routes/auth.ts`, `middlewares/auth.ts`, `routes/sales.ts`, `routes/attachments.ts`, `routes/exports.ts`, `routes/clients.ts`, `routes/search.ts`
- Public surfaces: deployment root and login flow; authenticated API is mounted under `/api/*`
- Admin-only boundary is policy-sensitive and must be checked for side channels and auxiliary routes, not just primary CRUD pages
- Dev-only area usually out of scope: `artifacts/mockup-sandbox`

## Threat Categories

### Spoofing

The application relies entirely on server-stored sessions and the `role` value attached to them. The system must require an unpredictable, deployment-specific session secret, must issue cookies with production-safe settings, and must only trust server-derived session state when deciding whether a caller is an admin or a secretary.

### Tampering

Authenticated users can create and modify products, sales, clients, attachments, and financial records. The server must validate inputs at every route, calculate sensitive business fields server-side, and prevent lower-privilege users from modifying records or fields that exceed their role.

### Information Disclosure

This ERP stores sensitive commercial data and customer PII, including troc documents. API responses, exports, invoices, and attachment downloads must be scoped to the correct role and requester, and server-generated content must not expose hidden fields or documents through alternate endpoints.

### Denial of Service

The application accepts file uploads and generates spreadsheets and invoices dynamically. Upload, parsing, and export paths must enforce size limits and avoid turning cheap authenticated requests into expensive memory, CPU, or database work.

### Elevation of Privilege

The main privilege boundary is `admin` versus `secretary`. Every admin-only or sensitive data path must enforce authorization server-side, including secondary features such as search, exports, file access, and generated documents. User-controlled content must not be able to execute script or formulas in privileged users’ browsers or desktop applications.
