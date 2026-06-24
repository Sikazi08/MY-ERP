---
name: Troc attachments architecture
description: How troc phone attachments are stored and served in the homies-erp
---

## Storage
- Table: `troc_attachments` (id, product_id, type, filename, mime_type, file_data TEXT base64, uploaded_by_user_id, created_at)
- Files stored as base64 TEXT in DB (suitable for PDFs/images up to ~5MB)
- Types: 'facture' | 'declaration' | 'cni'

## API endpoints (all under /api/attachments)
- `GET /products/:id` — list attachments for a product (no file_data in response)
- `POST /products/:id` — upload (multipart/form-data, fields: file + type)
- `GET /:id/download` — download with proper Content-Type header
- `DELETE /:id` — delete (admin or uploader)

## Upload flow from ventes.tsx
1. User fills troc sale form, selects files (invoice/declaration/cni)
2. `createMutation.onSuccess(saleData)` receives `trocProductId`
3. Upload each file to `/api/attachments/products/{trocProductId}`

## View flow from stock.tsx
- `AttachmentsSection` component (in stock.tsx) auto-fetches when productId changes
- Only shown when `product.entryMethod === "troc"` and `productType === "téléphone"`
- Allows add/download/delete in the product detail Sheet
