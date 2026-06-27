import { pgTable, text, serial, timestamp, numeric, date, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const expensesTable = pgTable("expenses", {
  id: serial("id").primaryKey(),
  label: text("label").notNull(),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  // flowType: depense | retrait_membre | entree
  flowType: text("flow_type").notNull().default("depense"),
  // direction: out (money leaving the caisse) | in (money entering the caisse)
  direction: text("direction").notNull().default("out"),
  // memberId: which member took the money (only for retrait_membre)
  memberId: integer("member_id").references(() => usersTable.id),
  note: text("note"),
  expenseDate: date("expense_date", { mode: "string" }).notNull(),
  expenseTime: text("expense_time").notNull(),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertExpenseSchema = createInsertSchema(expensesTable).omit({ id: true, createdAt: true });
export type InsertExpense = z.infer<typeof insertExpenseSchema>;
export type Expense = typeof expensesTable.$inferSelect;
