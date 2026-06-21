import { Router } from "express";
import { db, expensesTable, movementsTable, usersTable } from "@workspace/db";
import { eq, gte, lte, and } from "drizzle-orm";
import { requireAuth, requireAdmin } from "../middlewares/auth";

const router = Router();
function nowDateStr() { return new Date().toISOString().split("T")[0]; }
function nowTimeStr() { return new Date().toTimeString().slice(0, 8); }

router.get("/", requireAuth, async (req, res): Promise<void> => {
  const { dateFrom, dateTo } = req.query as Record<string, string>;
  const conditions = [];
  if (dateFrom) conditions.push(gte(expensesTable.expenseDate, dateFrom));
  if (dateTo) conditions.push(lte(expensesTable.expenseDate, dateTo));

  const rows = conditions.length > 0
    ? await db.select().from(expensesTable)
        .leftJoin(usersTable, eq(expensesTable.userId, usersTable.id))
        .where(and(...conditions))
        .orderBy(expensesTable.expenseDate)
    : await db.select().from(expensesTable)
        .leftJoin(usersTable, eq(expensesTable.userId, usersTable.id))
        .orderBy(expensesTable.expenseDate);

  res.json(rows.map(r => ({
    ...r.expenses,
    amount: Number(r.expenses.amount),
    user: r.users ? { id: r.users.id, username: r.users.username, fullName: r.users.fullName, role: r.users.role, createdAt: r.users.createdAt } : null,
  })).sort((a, b) => b.expenseDate.localeCompare(a.expenseDate) || b.expenseTime.localeCompare(a.expenseTime)));
});

router.post("/", requireAuth, async (req, res): Promise<void> => {
  const { label, amount, expenseDate } = req.body;
  if (!label || !amount || !expenseDate) {
    res.status(400).json({ error: "Libellé, montant et date sont requis" });
    return;
  }
  const time = nowTimeStr();
  const [row] = await db.insert(expensesTable).values({
    label,
    amount: String(amount),
    expenseDate,
    expenseTime: time,
    userId: req.session!.userId!,
  }).returning();

  await db.insert(movementsTable).values({
    movementType: "depense",
    movementDate: nowDateStr(),
    movementTime: time,
    userId: req.session!.userId!,
    description: `Dépense: ${label} - ${amount} FCFA`,
  });

  res.status(201).json({ ...row, amount: Number(row.amount) });
});

router.patch("/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  const { label, amount, expenseDate } = req.body;
  const updates: Record<string, unknown> = {};
  if (label) updates.label = label;
  if (amount !== undefined) updates.amount = String(amount);
  if (expenseDate) updates.expenseDate = expenseDate;
  const [row] = await db.update(expensesTable).set(updates).where(eq(expensesTable.id, id)).returning();
  if (!row) { res.status(404).json({ error: "Dépense non trouvée" }); return; }
  res.json({ ...row, amount: Number(row.amount) });
});

router.delete("/:id", requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  await db.delete(expensesTable).where(eq(expensesTable.id, id));
  res.status(204).send();
});

export default router;
