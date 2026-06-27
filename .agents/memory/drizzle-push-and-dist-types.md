---
name: Drizzle push pitfall & stale db dist types
description: Why `pnpm --filter @workspace/db push` is unsafe here, and why api-server typechecks against stale types after schema edits.
---

# Drizzle push wants to DROP the express-session table

`pnpm --filter @workspace/db push` (drizzle-kit push) compares the Drizzle schema
against the live Supabase DB and flags the `session` table (managed by
express-session / connect-pg-simple, NOT in the Drizzle schema) as a data-loss
DROP. It then blocks on an interactive TTY prompt and aborts in this
non-interactive shell. Using `push-force` would actually delete the session table.

**Why:** the session table is not part of the Drizzle schema, so push treats it as
drift to remove.

**How to apply:** for additive schema changes, do NOT use push/push-force. Apply
columns/enum values directly with idempotent SQL via psql `"$DATABASE_URL"`:
- `ALTER TABLE x ADD COLUMN IF NOT EXISTS ...`
- enum values must be separate, non-transactional statements: `ALTER TYPE t ADD VALUE IF NOT EXISTS '...'`

# api-server typechecks against stale db .d.ts after schema edits

`@workspace/db` package.json `exports` points at `./src/*.ts`, but `tsconfig.json`
is `composite` with `emitDeclarationOnly` to `dist/`. With TS project references,
api-server typechecks against `lib/db/dist/**/*.d.ts`, which is STALE until rebuilt.
There is no `build` npm script.

**How to apply:** after editing any `lib/db/src/schema/*.ts`, regenerate decls with
`pnpm --filter @workspace/db exec tsc -b --force` before relying on api-server tsc.

# Transient dashboard 500 right after an ALTER

Immediately after adding columns, the first stats query (filtered sum on the new
`direction` column) failed once with drizzle "Failed query"; the identical
parameterized query succeeded via psql and the `pg` driver after a server restart.
Treat a one-time post-ALTER query failure as a pooler schema-cache blip, not a code
defect — restart api-server and re-verify.
