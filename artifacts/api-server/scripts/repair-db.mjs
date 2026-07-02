import fs from "node:fs";
import path from "node:path";
import pg from "pg";

const { Pool } = pg;

function parseEnvLine(line) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) return null;

  const separator = trimmed.indexOf("=");
  if (separator <= 0) return null;

  const key = trimmed.slice(0, separator).trim();
  let value = trimmed.slice(separator + 1).trim();

  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1);
  }

  return [key, value];
}

function findEnvFile(startDir) {
  let current = startDir;

  while (true) {
    const candidate = path.join(current, ".env");
    if (fs.existsSync(candidate)) return candidate;

    const parent = path.dirname(current);
    if (parent === current) return null;
    current = parent;
  }
}

const envFile = findEnvFile(process.cwd());
if (envFile) {
  const content = fs.readFileSync(envFile, "utf8");
  for (const line of content.split(/\r?\n/)) {
    const parsed = parseEnvLine(line);
    if (!parsed) continue;
    const [key, value] = parsed;
    process.env[key] ??= value;
  }
}

const connectionString = process.env.SUPABASE_DATABASE_URL || process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL or SUPABASE_DATABASE_URL must be set.");

const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false },
});

const migrations = [
  {
    name: "products.phone_state",
    sql: `alter table if exists products add column if not exists phone_state text`,
  },
  {
    name: "products.individual_name",
    sql: `alter table if exists products add column if not exists individual_name text`,
  },
  {
    name: "products.individual_phone",
    sql: `alter table if exists products add column if not exists individual_phone text`,
  },
  {
    name: "products.merge_duplicate_active_accessories",
    sql: `
      with active_accessories as (
        select
          id,
          quantity,
          min(id) over (
            partition by
              lower(trim(product)),
              coalesce(lower(trim(brand)), ''),
              coalesce(lower(trim(capacity)), ''),
              coalesce(lower(trim(color)), '')
          ) as keep_id,
          sum(quantity) over (
            partition by
              lower(trim(product)),
              coalesce(lower(trim(brand)), ''),
              coalesce(lower(trim(capacity)), ''),
              coalesce(lower(trim(color)), '')
          ) as total_quantity,
          count(*) over (
            partition by
              lower(trim(product)),
              coalesce(lower(trim(brand)), ''),
              coalesce(lower(trim(capacity)), ''),
              coalesce(lower(trim(color)), '')
          ) as duplicate_count
        from products
        where product_type = 'accessoire' and quantity <> 0
      )
      update products p
      set quantity = case when p.id = a.keep_id then a.total_quantity else 0 end
      from active_accessories a
      where p.id = a.id and a.duplicate_count > 1
    `,
  },
  {
    name: "products.prevent_duplicate_phone_imei_trigger",
    sql: `
      create or replace function prevent_duplicate_active_phone_imei()
      returns trigger
      language plpgsql
      as $$
      begin
        if new.product_type = 'téléphone'
           and new.quantity <> 0
           and new.imei is not null
           and trim(new.imei) <> ''
           and exists (
             select 1
             from products p
             where p.id <> coalesce(new.id, -1)
               and p.product_type = 'téléphone'
               and p.quantity <> 0
               and p.imei = new.imei
           ) then
          raise exception 'Ce téléphone existe déjà en stock (IMEI déjà enregistré).'
            using errcode = '23505', constraint = 'products_unique_phone_imei';
        end if;
        return new;
      end;
      $$;

      drop trigger if exists products_prevent_duplicate_active_phone_imei on products;
      create trigger products_prevent_duplicate_active_phone_imei
      before insert or update of imei, product_type, quantity
      on products
      for each row
      execute function prevent_duplicate_active_phone_imei();
    `,
  },
  {
    name: "products.prevent_duplicate_accessory_trigger",
    sql: `
      create or replace function prevent_duplicate_active_accessory_identity()
      returns trigger
      language plpgsql
      as $$
      begin
        if new.product_type = 'accessoire'
           and new.quantity <> 0
           and exists (
             select 1
             from products p
             where p.id <> coalesce(new.id, -1)
               and p.product_type = 'accessoire'
               and p.quantity <> 0
               and lower(trim(p.product)) = lower(trim(new.product))
               and coalesce(lower(trim(p.brand)), '') = coalesce(lower(trim(new.brand)), '')
               and coalesce(lower(trim(p.capacity)), '') = coalesce(lower(trim(new.capacity)), '')
               and coalesce(lower(trim(p.color)), '') = coalesce(lower(trim(new.color)), '')
           ) then
          raise exception 'Cet accessoire existe déjà en stock. Souhaitez-vous simplement ajouter cette quantité au stock existant ?'
            using errcode = '23505', constraint = 'products_unique_active_accessory_identity';
        end if;
        return new;
      end;
      $$;

      drop trigger if exists products_prevent_duplicate_active_accessory_identity on products;
      create trigger products_prevent_duplicate_active_accessory_identity
      before insert or update of product, brand, capacity, color, product_type, quantity
      on products
      for each row
      execute function prevent_duplicate_active_accessory_identity();
    `,
  },
];

try {
  for (const migration of migrations) {
    await pool.query(migration.sql);
    console.log(`OK ${migration.name}`);
  }
} finally {
  await pool.end();
}
