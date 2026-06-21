import { Router } from "express";
import { db, productsTable, movementsTable } from "@workspace/db";
import { eq, ilike, or, and } from "drizzle-orm";
import { requireAuth, requireAdmin } from "../middlewares/auth";

const router = Router();

async function generateProductId(): Promise<string> {
  const products = await db.select({ productId: productsTable.productId }).from(productsTable).orderBy(productsTable.id);
  const max = products.reduce((acc, p) => {
    const num = parseInt(p.productId.replace("TH", ""), 10);
    return isNaN(num) ? acc : Math.max(acc, num);
  }, 0);
  return `TH${String(max + 1).padStart(3, "0")}`;
}

function nowDateStr() {
  return new Date().toISOString().split("T")[0];
}
function nowTimeStr() {
  return new Date().toTimeString().slice(0, 8);
}

router.get("/", requireAuth, async (req, res): Promise<void> => {
  const { status, search } = req.query as Record<string, string>;
  const conditions = [];
  if (status && status !== "tous") conditions.push(eq(productsTable.status, status as "en_stock" | "chez_partenaire" | "vendu"));
  if (search) {
    conditions.push(
      or(
        ilike(productsTable.imei, `%${search}%`),
        ilike(productsTable.product, `%${search}%`),
        ilike(productsTable.brand, `%${search}%`),
        ilike(productsTable.productId, `%${search}%`),
      )
    );
  }
  const rows = conditions.length > 0
    ? await db.select().from(productsTable).where(and(...conditions)).orderBy(productsTable.id)
    : await db.select().from(productsTable).orderBy(productsTable.id);

  const isAdmin = req.session!.role === "admin";
  const mapped = rows.map(p => ({
    ...p,
    purchasePrice: isAdmin ? (p.purchasePrice !== null ? Number(p.purchasePrice) : null) : undefined,
    sellingPrice: p.sellingPrice !== null ? Number(p.sellingPrice) : null,
    profit: isAdmin && p.purchasePrice !== null && p.sellingPrice !== null
      ? Number(p.sellingPrice) - Number(p.purchasePrice)
      : null,
  }));
  res.json(mapped);
});

router.post("/", requireAuth, async (req, res): Promise<void> => {
  const { imei, product, brand, capacity, color, supplier, purchasePrice, sellingPrice, status, entryDate } = req.body;
  if (!product || !brand || !entryDate) {
    res.status(400).json({ error: "Produit, marque et date d'entrée sont requis" });
    return;
  }
  const productId = await generateProductId();
  const [row] = await db.insert(productsTable).values({
    productId,
    imei: imei || null,
    product,
    brand,
    capacity: capacity || null,
    color: color || null,
    supplier: supplier || null,
    purchasePrice: purchasePrice !== undefined && purchasePrice !== "" ? String(purchasePrice) : null,
    sellingPrice: sellingPrice !== undefined && sellingPrice !== "" ? String(sellingPrice) : null,
    status: status || "en_stock",
    entryDate,
  }).returning();

  await db.insert(movementsTable).values({
    movementType: "achat",
    movementDate: nowDateStr(),
    movementTime: nowTimeStr(),
    userId: req.session!.userId!,
    productId: row.id,
    productRef: row.productId,
    imei: row.imei,
    description: `Ajout produit: ${product} ${brand} (${productId})`,
  });

  const isAdmin = req.session!.role === "admin";
  res.status(201).json({
    ...row,
    purchasePrice: isAdmin ? (row.purchasePrice !== null ? Number(row.purchasePrice) : null) : undefined,
    sellingPrice: row.sellingPrice !== null ? Number(row.sellingPrice) : null,
    profit: isAdmin && row.purchasePrice !== null && row.sellingPrice !== null
      ? Number(row.sellingPrice) - Number(row.purchasePrice)
      : null,
  });
});

router.get("/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  const [row] = await db.select().from(productsTable).where(eq(productsTable.id, id)).limit(1);
  if (!row) { res.status(404).json({ error: "Produit non trouvé" }); return; }
  const isAdmin = req.session!.role === "admin";
  res.json({
    ...row,
    purchasePrice: isAdmin ? (row.purchasePrice !== null ? Number(row.purchasePrice) : null) : undefined,
    sellingPrice: row.sellingPrice !== null ? Number(row.sellingPrice) : null,
    profit: isAdmin && row.purchasePrice !== null && row.sellingPrice !== null
      ? Number(row.sellingPrice) - Number(row.purchasePrice)
      : null,
  });
});

router.patch("/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  const { imei, product, brand, capacity, color, supplier, purchasePrice, sellingPrice, status, entryDate } = req.body;
  const isAdmin = req.session!.role === "admin";

  if (!isAdmin && status === "vendu") {
    res.status(403).json({ error: "Action non autorisée" });
    return;
  }

  const updates: Record<string, unknown> = {};
  if (imei !== undefined) updates.imei = imei;
  if (product) updates.product = product;
  if (brand) updates.brand = brand;
  if (capacity !== undefined) updates.capacity = capacity;
  if (color !== undefined) updates.color = color;
  if (supplier !== undefined) updates.supplier = supplier;
  if (isAdmin && purchasePrice !== undefined) updates.purchasePrice = purchasePrice !== "" ? String(purchasePrice) : null;
  if (sellingPrice !== undefined) updates.sellingPrice = sellingPrice !== "" ? String(sellingPrice) : null;
  if (status) updates.status = status;
  if (entryDate) updates.entryDate = entryDate;

  const [row] = await db.update(productsTable).set(updates).where(eq(productsTable.id, id)).returning();
  if (!row) { res.status(404).json({ error: "Produit non trouvé" }); return; }

  await db.insert(movementsTable).values({
    movementType: "modification_produit",
    movementDate: nowDateStr(),
    movementTime: nowTimeStr(),
    userId: req.session!.userId!,
    productId: row.id,
    productRef: row.productId,
    imei: row.imei,
    description: `Modification produit: ${row.product} ${row.brand} (${row.productId})`,
  });

  res.json({
    ...row,
    purchasePrice: isAdmin ? (row.purchasePrice !== null ? Number(row.purchasePrice) : null) : undefined,
    sellingPrice: row.sellingPrice !== null ? Number(row.sellingPrice) : null,
    profit: isAdmin && row.purchasePrice !== null && row.sellingPrice !== null
      ? Number(row.sellingPrice) - Number(row.purchasePrice)
      : null,
  });
});

router.delete("/:id", requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  const [row] = await db.select().from(productsTable).where(eq(productsTable.id, id)).limit(1);
  if (!row) { res.status(404).json({ error: "Produit non trouvé" }); return; }

  await db.insert(movementsTable).values({
    movementType: "suppression_produit",
    movementDate: nowDateStr(),
    movementTime: nowTimeStr(),
    userId: req.session!.userId!,
    productId: row.id,
    productRef: row.productId,
    imei: row.imei,
    description: `Suppression produit: ${row.product} ${row.brand} (${row.productId})`,
  });

  await db.delete(productsTable).where(eq(productsTable.id, id));
  res.status(204).send();
});

export default router;
