import { pgTable, text, serial, integer, timestamp, numeric, date, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const productStatusEnum = pgEnum("product_status", ["en_stock", "chez_partenaire", "vendu"]);

export const productsTable = pgTable("products", {
  id: serial("id").primaryKey(),
  productId: text("product_id").notNull().unique(),
  imei: text("imei"),
  product: text("product").notNull(),
  brand: text("brand"),
  capacity: text("capacity"),
  color: text("color"),
  supplier: text("supplier"),
  purchasePrice: numeric("purchase_price", { precision: 12, scale: 2 }),
  sellingPrice: numeric("selling_price", { precision: 12, scale: 2 }),
  status: productStatusEnum("status").notNull().default("en_stock"),
  entryDate: date("entry_date", { mode: "string" }).notNull(),
  saleDate: date("sale_date", { mode: "string" }),
  createdByUserId: integer("created_by_user_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertProductSchema = createInsertSchema(productsTable).omit({ id: true, createdAt: true });
export type InsertProduct = z.infer<typeof insertProductSchema>;
export type Product = typeof productsTable.$inferSelect;
