import { pgTable, text, serial, timestamp, integer, date, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const movementTypeEnum = pgEnum("movement_type", [
  "achat",
  "vente",
  "entree_troc",
  "depense",
  "retrait_membre",
  "entree_caisse",
  "sortie_partenaire",
  "retour_partenaire",
  "modification_produit",
  "suppression_produit",
  "annulation",
]);

export const movementsTable = pgTable("movements", {
  id: serial("id").primaryKey(),
  movementType: movementTypeEnum("movement_type").notNull(),
  movementDate: date("movement_date", { mode: "string" }).notNull(),
  movementTime: text("movement_time").notNull(),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  productId: integer("product_id"),
  productRef: text("product_ref"),
  imei: text("imei"),
  description: text("description").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertMovementSchema = createInsertSchema(movementsTable).omit({ id: true, createdAt: true });
export type InsertMovement = z.infer<typeof insertMovementSchema>;
export type Movement = typeof movementsTable.$inferSelect;
