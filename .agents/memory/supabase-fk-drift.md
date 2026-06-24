---
name: Supabase FK constraint drift
description: External Supabase DB (used dev+prod) does NOT auto-apply Drizzle schema .references() changes; FK constraints drift and cause silent insert 500s.
---

# Supabase FK constraint drift

The ERP's primary database is an **external Supabase** instance, selected at runtime via
`SUPABASE_DATABASE_URL` (priority over `DATABASE_URL`). Dev AND the deployed app both
connect to the **same** Supabase DB.

**The rule:** changing a Drizzle `.references(() => X)` in `lib/db/src/schema/*` does
NOT migrate the live Supabase constraints. There is no migration runner against Supabase,
and Replit's publish-time schema diff only manages Replit-managed Postgres, not Supabase.
So the DB's foreign keys can silently lag the code.

**Why this bit us:** `sales.vendor_id` and `sales.seller_id` constraints in Supabase
pointed at the wrong tables (`vendor_id`→`users`, `seller_id`→`sellers`) while the schema
intended `vendor_id`→`sellers`, `seller_id`→`users`. Inserts only failed when the wrong
table lacked the id — e.g. a sale with an external vendor (`vendor_id` set) threw
`23503 sales_vendor_id_fkey ... not present in table "users"` → HTTP 500, "la vente ne
s'enregistre pas". Simple sales (vendor_id null, and user.id coincidentally matching a
seller.id) passed, which masked it.

**How to diagnose:** the app log only shows drizzle's generic `Failed query: insert ...`.
Get the real Postgres error (constraint name + `detail:`) by reproducing the exact insert
with `pg` directly against `SUPABASE_DATABASE_URL` (ssl rejectUnauthorized:false).
`executeSql` with `environment:"production"` hits the Replit-managed replica, NOT Supabase,
so its schema/data can mislead you — trust a direct Supabase connection.

**How to apply:** after any `.references()` change, manually `ALTER TABLE ... DROP CONSTRAINT
.../ ADD CONSTRAINT ... FOREIGN KEY ... REFERENCES ...` on Supabase. Audit all FKs vs schema
with a `pg_constraint` join query.
