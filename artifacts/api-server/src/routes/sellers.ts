import { Router } from "express";
import { db, sellersTable, salesTable, productsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth, requireAdmin } from "../middlewares/auth";

const router = Router();

router.get("/", requireAuth, async (req, res): Promise<void> => {
  const { activeOnly } = req.query as Record<string, string>;
  const rows = activeOnly === "true"
    ? await db.select().from(sellersTable).where(eq(sellersTable.isActive, true)).orderBy(sellersTable.name)
    : await db.select().from(sellersTable).orderBy(sellersTable.name);
  res.json(rows);
});

router.post("/", requireAdmin, async (req, res): Promise<void> => {
  const { name, phone, address, notes } = req.body;
  if (!name) { res.status(400).json({ error: "Le nom du vendeur est requis" }); return; }
  const [row] = await db.insert(sellersTable).values({ name, phone, address, notes }).returning();
  res.status(201).json(row);
});

router.patch("/:id", requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  const { name, phone, address, notes, isActive } = req.body;
  const updates: Record<string, unknown> = {};
  if (name !== undefined) updates.name = name;
  if (phone !== undefined) updates.phone = phone;
  if (address !== undefined) updates.address = address;
  if (notes !== undefined) updates.notes = notes;
  if (isActive !== undefined) updates.isActive = isActive;
  const [row] = await db.update(sellersTable).set(updates).where(eq(sellersTable.id, id)).returning();
  if (!row) { res.status(404).json({ error: "Vendeur non trouvé" }); return; }
  res.json(row);
});

router.delete("/:id", requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  const [row] = await db.select().from(sellersTable).where(eq(sellersTable.id, id)).limit(1);
  if (!row) { res.status(404).json({ error: "Vendeur non trouvé" }); return; }
  await db.delete(sellersTable).where(eq(sellersTable.id, id));
  res.status(204).send();
});

router.get("/:id/sales", requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  const rows = await db.select().from(salesTable)
    .leftJoin(productsTable, eq(salesTable.productId, productsTable.id))
    .where(eq(salesTable.vendorId, id))
    .orderBy(salesTable.saleDate);
  res.json(rows.map(r => ({
    ...r.sales,
    amount: Number(r.sales.amount),
    product: r.products ? { ...r.products, sellingPrice: r.products.sellingPrice !== null ? Number(r.products.sellingPrice) : null } : null,
  })));
});

export default router;
