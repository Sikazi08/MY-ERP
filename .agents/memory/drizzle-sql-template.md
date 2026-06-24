---
name: Drizzle sql() column references
description: How to correctly reference table columns inside Drizzle sql`` template literals
---

When using Drizzle's `sql` tagged template, you must reference columns via their **camelCase JavaScript property** on the table object — NOT the snake_case DB column name.

**Wrong (renders as empty string):**
```ts
sql`count(*) filter (where ${productsTable.product_type} = 'téléphone')`
```

**Correct:**
```ts
sql`count(*) filter (where ${productsTable.productType} = 'téléphone')`
```

**Why:** Drizzle's template interpolation calls `.toSQL()` on column references. The column object is accessed via the camelCase alias on the table. `productsTable.product_type` is `undefined`; `productsTable.productType` is the actual Column object.

**How to apply:** Any time you write a raw `sql`` ` expression in this codebase, use the camelCase property name that matches the Drizzle schema definition.
