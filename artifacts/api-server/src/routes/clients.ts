import { Router } from "express";
import { db, clientsTable, salesTable } from "@workspace/db";
import { eq, ilike, or, sql } from "drizzle-orm";
import { requireAdmin } from "../middlewares/auth";

const router = Router();

router.get("/", requireAdmin, async (req, res): Promise<void> => {
  const { search } = req.query as Record<string, string>;

  const clients = search
    ? await db.select().from(clientsTable).where(
        or(ilike(clientsTable.fullName, `%${search}%`), ilike(clientsTable.phone, `%${search}%`))
      ).orderBy(clientsTable.fullName)
    : await db.select().from(clientsTable).orderBy(clientsTable.fullName);

  const salesData = await db.select({
    clientId: salesTable.clientId,
    count: sql<number>`count(*)::int`,
    total: sql<number>`sum(${salesTable.amount}::numeric)`,
    lastDate: sql<string>`max(${salesTable.saleDate})`,
  }).from(salesTable).where(sql`${salesTable.clientId} is not null AND ${salesTable.cancelled} = false`).groupBy(salesTable.clientId);

  const salesMap = new Map(salesData.map(s => [s.clientId, s]));

  res.json(clients.map(c => {
    const s = salesMap.get(c.id);
    return {
      ...c,
      purchaseCount: s?.count ?? 0,
      totalPurchases: s ? Number(s.total) : 0,
      lastPurchaseDate: s?.lastDate ?? null,
    };
  }));
});

router.post("/", requireAdmin, async (req, res): Promise<void> => {
  const { fullName, phone } = req.body;
  if (!fullName) { res.status(400).json({ error: "Le nom est requis" }); return; }
  const [row] = await db.insert(clientsTable).values({ fullName, phone: phone || null }).returning();
  res.status(201).json({ ...row, purchaseCount: 0, totalPurchases: 0, lastPurchaseDate: null });
});

router.get("/:id", requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  const [client] = await db.select().from(clientsTable).where(eq(clientsTable.id, id)).limit(1);
  if (!client) { res.status(404).json({ error: "Client non trouvé" }); return; }
  const purchases = await db.select().from(salesTable).where(eq(salesTable.clientId, id)).orderBy(salesTable.saleDate);
  const valid = purchases.filter(p => !p.cancelled);
  res.json({
    ...client,
    purchaseCount: valid.length,
    totalPurchases: valid.reduce((sum, p) => sum + Number(p.amount), 0),
    lastPurchaseDate: valid.length > 0 ? valid[valid.length - 1].saleDate : null,
    purchases: purchases.map(p => ({ ...p, amount: Number(p.amount) })),
  });
});

router.patch("/:id", requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  const { fullName, phone } = req.body;
  const updates: Record<string, unknown> = {};
  if (fullName) updates.fullName = fullName;
  if (phone !== undefined) updates.phone = phone;
  const [row] = await db.update(clientsTable).set(updates).where(eq(clientsTable.id, id)).returning();
  if (!row) { res.status(404).json({ error: "Client non trouvé" }); return; }
  res.json({ ...row, purchaseCount: 0, totalPurchases: 0, lastPurchaseDate: null });
});

export default router;
