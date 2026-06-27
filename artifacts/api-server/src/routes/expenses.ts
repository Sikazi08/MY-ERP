import { Router } from "express";
import { db, expensesTable, movementsTable, usersTable } from "@workspace/db";
import { eq, gte, lte, and } from "drizzle-orm";
import { requireAuth, requireAdmin } from "../middlewares/auth";

const router = Router();
function nowDateStr() { return new Date().toISOString().split("T")[0]; }
function nowTimeStr() { return new Date().toTimeString().slice(0, 8); }

const FLOW_TYPES = ["depense", "retrait_membre", "entree"] as const;
type FlowType = typeof FLOW_TYPES[number];
function directionFor(flowType: FlowType): "in" | "out" {
  return flowType === "entree" ? "in" : "out";
}

// List of members (app users) for the withdrawal dropdown. Accessible to any
// authenticated user (the /users endpoint is admin-only).
router.get("/members", requireAuth, async (_req, res): Promise<void> => {
  const members = await db.select({ id: usersTable.id, fullName: usersTable.fullName, role: usersTable.role })
    .from(usersTable).orderBy(usersTable.fullName);
  res.json(members);
});

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

  // Resolve member names from a single users lookup.
  const allUsers = await db.select({ id: usersTable.id, fullName: usersTable.fullName }).from(usersTable);
  const userMap = new Map(allUsers.map(u => [u.id, u.fullName]));

  res.json(rows.map(r => ({
    ...r.expenses,
    amount: Number(r.expenses.amount),
    memberName: r.expenses.memberId != null ? (userMap.get(r.expenses.memberId) ?? null) : null,
    user: r.users ? { id: r.users.id, username: r.users.username, fullName: r.users.fullName, role: r.users.role, createdAt: r.users.createdAt } : null,
  })).sort((a, b) => b.expenseDate.localeCompare(a.expenseDate) || b.expenseTime.localeCompare(a.expenseTime)));
});

router.post("/", requireAuth, async (req, res): Promise<void> => {
  const { label, amount, expenseDate, note } = req.body;
  const flowType: FlowType = FLOW_TYPES.includes(req.body.flowType) ? req.body.flowType : "depense";
  const memberId = req.body.memberId != null ? Number(req.body.memberId) : null;

  if (!label || !amount || !expenseDate) {
    res.status(400).json({ error: "Libellé, montant et date sont requis" });
    return;
  }
  if (flowType === "retrait_membre" && !memberId) {
    res.status(400).json({ error: "Le membre est requis pour un retrait" });
    return;
  }

  const direction = directionFor(flowType);
  const time = nowTimeStr();
  const [row] = await db.insert(expensesTable).values({
    label,
    amount: String(amount),
    flowType,
    direction,
    memberId: flowType === "retrait_membre" ? memberId : null,
    note: note || null,
    expenseDate,
    expenseTime: time,
    userId: req.session!.userId!,
  }).returning();

  // Audit ledger entry
  let memberName = "";
  if (memberId) {
    const [m] = await db.select({ fullName: usersTable.fullName }).from(usersTable).where(eq(usersTable.id, memberId));
    memberName = m?.fullName ?? "";
  }
  const movementType = flowType === "entree" ? "entree_caisse" : flowType === "retrait_membre" ? "retrait_membre" : "depense";
  const description = flowType === "entree"
    ? `Entrée caisse: ${label} - ${amount} FCFA`
    : flowType === "retrait_membre"
      ? `Retrait caisse${memberName ? ` par ${memberName}` : ""}: ${label} - ${amount} FCFA`
      : `Dépense: ${label} - ${amount} FCFA`;

  await db.insert(movementsTable).values({
    movementType,
    movementDate: nowDateStr(),
    movementTime: time,
    userId: req.session!.userId!,
    description,
  });

  res.status(201).json({ ...row, amount: Number(row.amount) });
});

router.patch("/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  const { label, amount, expenseDate, note } = req.body;

  const [existing] = await db.select().from(expensesTable).where(eq(expensesTable.id, id));
  if (!existing) { res.status(404).json({ error: "Opération non trouvée" }); return; }

  // Effective flow type after the update (new one if provided, else current).
  const effectiveFlowType: FlowType = FLOW_TYPES.includes(req.body.flowType)
    ? (req.body.flowType as FlowType)
    : (existing.flowType as FlowType);

  // Effective member after the update.
  const effectiveMemberId = req.body.memberId !== undefined
    ? (req.body.memberId != null ? Number(req.body.memberId) : null)
    : existing.memberId;

  // Enforce the same invariants as creation: a withdrawal must reference a member;
  // any non-withdrawal operation must not keep a member reference.
  if (effectiveFlowType === "retrait_membre" && !effectiveMemberId) {
    res.status(400).json({ error: "Le membre est requis pour un retrait" });
    return;
  }

  const updates: Record<string, unknown> = {};
  if (label) updates.label = label;
  if (amount !== undefined) updates.amount = String(amount);
  if (expenseDate) updates.expenseDate = expenseDate;
  if (note !== undefined) updates.note = note || null;
  updates.flowType = effectiveFlowType;
  updates.direction = directionFor(effectiveFlowType);
  updates.memberId = effectiveFlowType === "retrait_membre" ? effectiveMemberId : null;

  const [row] = await db.update(expensesTable).set(updates).where(eq(expensesTable.id, id)).returning();
  res.json({ ...row, amount: Number(row.amount) });
});

router.delete("/:id", requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  await db.delete(expensesTable).where(eq(expensesTable.id, id));
  res.status(204).send();
});

export default router;
