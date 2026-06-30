import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

const connectionString = process.env.SUPABASE_DATABASE_URL || process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

const needsSsl =
  !!process.env.SUPABASE_DATABASE_URL ||
  connectionString.includes("supabase.co") ||
  connectionString.includes("supabase.com") ||
  connectionString.includes("sslmode=require");

export const pool = new Pool({
  connectionString,
  ssl: needsSsl ? { rejectUnauthorized: false } : undefined,
});

const rawQuery = pool.query.bind(pool) as (...args: unknown[]) => unknown;
(pool as unknown as { query: (...args: unknown[]) => unknown }).query = (queryConfig: unknown, ...args: unknown[]) => {
  if (queryConfig && typeof queryConfig === "object" && "name" in queryConfig) {
    const { name: _name, ...unnamedQueryConfig } = queryConfig as Record<string, unknown>;
    return rawQuery(unnamedQueryConfig, ...args);
  }

  return rawQuery(queryConfig, ...args);
};

export const db = drizzle(pool, { schema });

export * from "./schema";
