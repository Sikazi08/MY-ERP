import { pgTable, text, serial, timestamp, numeric, date, integer, boolean, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { productsTable } from "./products";
import { usersTable } from "./users";
import { clientsTable } from "./clients";
import { sellersTable } from "./sellers";

export const saleTypeEnum = pgEnum("sale_type", ["normal", "troc"]);
export const paymentModeEnum = pgEnum("payment_mode", ["OM", "MOMO", "Cash"]);

export const salesTable = pgTable("sales", {
  id: serial("id").primaryKey(),
  productId: integer("product_id").notNull().references(() => productsTable.id),
  saleType: saleTypeEnum("sale_type").notNull().default("normal"),
  paymentMode: paymentModeEnum("payment_mode").notNull(),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  clientId: integer("client_id").references(() => clientsTable.id),
  clientName: text("client_name"),
  clientPhone: text("client_phone"),
  sellerId: integer("seller_id").notNull().references(() => usersTable.id),
  vendorId: integer("vendor_id").references(() => sellersTable.id),
  vendorName: text("vendor_name"),
  saleDate: date("sale_date", { mode: "string" }).notNull(),
  saleTime: text("sale_time").notNull(),
  cancelled: boolean("cancelled").notNull().default(false),
  cancellationReason: text("cancellation_reason"),
  trocProductId: integer("troc_product_id").references(() => productsTable.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertSaleSchema = createInsertSchema(salesTable).omit({ id: true, createdAt: true });
export type InsertSale = z.infer<typeof insertSaleSchema>;
export type Sale = typeof salesTable.$inferSelect;
