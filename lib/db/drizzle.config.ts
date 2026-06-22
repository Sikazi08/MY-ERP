import { defineConfig } from "drizzle-kit";
import path from "path";

const url = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;

if (!url) {
  throw new Error("SUPABASE_DB_URL ou DATABASE_URL doit être défini.");
}

export default defineConfig({
  schema: path.join(__dirname, "./src/schema/index.ts"),
  dialect: "postgresql",
  dbCredentials: { url },
});
