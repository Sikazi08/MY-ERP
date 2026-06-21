import { pgTable, text, serial, timestamp, integer, date, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { productsTable } from "./products";

export const partnerMovementTypeEnum = pgEnum("partner_movement_type", ["sortie", "retour"]);

export const partnersTable = pgTable("partners", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  phone: text("phone"),
  address: text("address"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const partnerMovementsTable = pgTable("partner_movements", {
  id: serial("id").primaryKey(),
  partnerId: integer("partner_id").notNull().references(() => partnersTable.id),
  productId: integer("product_id").notNull().references(() => productsTable.id),
  movementType: partnerMovementTypeEnum("movement_type").notNull(),
  movementDate: date("movement_date", { mode: "string" }).notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertPartnerSchema = createInsertSchema(partnersTable).omit({ id: true, createdAt: true });
export const insertPartnerMovementSchema = createInsertSchema(partnerMovementsTable).omit({ id: true, createdAt: true });
export type InsertPartner = z.infer<typeof insertPartnerSchema>;
export type Partner = typeof partnersTable.$inferSelect;
export type PartnerMovement = typeof partnerMovementsTable.$inferSelect;
