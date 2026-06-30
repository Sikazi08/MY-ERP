import { Router } from "express";
import { db, movementsTable, usersTable } from "@workspace/db";
import { eq, gte, lte, and, ilike, or } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";

const router = Router();

router.get("/", requireAuth, async (req, res): Promise<void> => {
  const { type, status, dateFrom, dateTo, search } = req.query as Record<string, string>;
  const selectedType = status && status !== "tous" ? status : type;

  const rows = await db.select().from(movementsTable)
    .leftJoin(usersTable, eq(movementsTable.userId, usersTable.id))
    .orderBy(movementsTable.movementDate);

  const filtered = rows.filter(r => {
    const m = r.movements;
    if (selectedType && selectedType !== "tous" && m.movementType !== selectedType) return false;
    if (dateFrom && m.movementDate < dateFrom) return false;
    if (dateTo && m.movementDate > dateTo) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!m.description.toLowerCase().includes(q) &&
          !m.productRef?.toLowerCase().includes(q) &&
          !m.imei?.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  res.json(filtered.map(r => ({
    ...r.movements,
    user: r.users ? { id: r.users.id, username: r.users.username, fullName: r.users.fullName, role: r.users.role, createdAt: r.users.createdAt } : null,
  })).sort((a, b) => b.movementDate.localeCompare(a.movementDate) || b.movementTime.localeCompare(a.movementTime)));
});

export default router;
