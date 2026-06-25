---
name: Invoice logo via base64
description: Why printed invoices (api-server) embed the shop logo as a base64 data URI instead of a /homies-erp/ URL
---

# Invoice logo must be embedded as base64

Printed invoices are HTML served by **api-server** (`GET /api/sales/:id/invoice`). Embed the shop
logo as a base64 `data:image/png;base64,...` constant (`artifacts/api-server/src/logo.ts`, imported
into the route), NOT as `<img src="/homies-erp/logo.png">`.

**Why:** The web (Vite) artifact does NOT reliably serve `/homies-erp/logo.png` to pages rendered by
a different artifact. Through the shared-domain proxy / Vite dev server that path returns the SPA
`index.html` fallback (text/html) or 404 (when requested with an image `Accept` header) — so the logo
silently fails to load on the invoice. The login page works only because it requests the asset from
within its own Vite app context.

**How to apply:** Any asset that must appear on an api-server-rendered HTML page (invoices, receipts,
PDFs) should be embedded (base64 data URI) so it is self-contained across dev, prod, print, and PDF
export. Regenerate the constant from `artifacts/homies-erp/public/logo.png` if the logo changes.
