import { Router } from "express";
import { db, productsTable, movementsTable } from "@workspace/db";
import { eq, ilike, or, and, gte, lte } from "drizzle-orm";
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

function nowDateStr() { return new Date().toISOString().split("T")[0]; }
function nowTimeStr() { return new Date().toTimeString().slice(0, 8); }

function mapProduct(p: typeof productsTable.$inferSelect, isAdmin: boolean) {
  return {
    ...p,
    brand: p.brand || null,
    purchasePrice: isAdmin ? (p.purchasePrice !== null ? Number(p.purchasePrice) : null) : undefined,
    sellingPrice: p.sellingPrice !== null ? Number(p.sellingPrice) : null,
    profit: isAdmin && p.purchasePrice !== null && p.sellingPrice !== null
      ? Number(p.sellingPrice) - Number(p.purchasePrice)
      : null,
  };
}

router.get("/", requireAuth, async (req, res): Promise<void> => {
  const { status, search, dateFrom, dateTo, page, limit } = req.query as Record<string, string>;
  const conditions = [];
  if (status && status !== "tous") conditions.push(eq(productsTable.status, status as "en_stock" | "chez_partenaire" | "vendu"));
  if (dateFrom) conditions.push(gte(productsTable.entryDate, dateFrom));
  if (dateTo) conditions.push(lte(productsTable.entryDate, dateTo));
  if (search) {
    conditions.push(
      or(
        ilike(productsTable.imei, `%${search}%`),
        ilike(productsTable.product, `%${search}%`),
        ilike(productsTable.brand, `%${search}%`),
        ilike(productsTable.productId, `%${search}%`),
        ilike(productsTable.supplier, `%${search}%`),
      )
    );
  }
  const rows = conditions.length > 0
    ? await db.select().from(productsTable).where(and(...conditions)).orderBy(productsTable.id)
    : await db.select().from(productsTable).orderBy(productsTable.id);

  const isAdmin = req.session!.role === "admin";

  const pageNum = parseInt(page || "1");
  const limitNum = parseInt(limit || "100");
  const total = rows.length;
  const paginated = rows.slice((pageNum - 1) * limitNum, pageNum * limitNum);

  res.json({
    data: paginated.map(p => mapProduct(p, isAdmin)),
    total,
    page: pageNum,
    limit: limitNum,
  });
});

router.post("/", requireAuth, async (req, res): Promise<void> => {
  const { imei, product, brand, capacity, color, supplier, purchasePrice, sellingPrice, status, entryDate } = req.body;
  if (!product || !entryDate) {
    res.status(400).json({ error: "Nom du produit et date d'entrée sont requis" });
    return;
  }

  if (imei) {
    const [existing] = await db.select({ id: productsTable.id }).from(productsTable).where(eq(productsTable.imei, imei)).limit(1);
    if (existing) {
      res.status(409).json({ error: `Un produit avec l'IMEI ${imei} existe déjà dans le système` });
      return;
    }
  }

  const productId = await generateProductId();
  const [row] = await db.insert(productsTable).values({
    productId,
    imei: imei || null,
    product,
    brand: brand || null,
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
    description: `Ajout produit: ${product}${brand ? " " + brand : ""} (${productId})`,
  });

  const isAdmin = req.session!.role === "admin";
  res.status(201).json(mapProduct(row, isAdmin));
});

router.get("/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  const [row] = await db.select().from(productsTable).where(eq(productsTable.id, id)).limit(1);
  if (!row) { res.status(404).json({ error: "Produit non trouvé" }); return; }
  const isAdmin = req.session!.role === "admin";
  res.json(mapProduct(row, isAdmin));
});

router.patch("/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  const { imei, product, brand, capacity, color, supplier, purchasePrice, sellingPrice, status, entryDate } = req.body;
  const isAdmin = req.session!.role === "admin";

  if (!isAdmin && (purchasePrice !== undefined)) {
    res.status(403).json({ error: "Seul l'admin peut modifier le prix d'achat" });
    return;
  }

  if (imei) {
    const [existing] = await db.select({ id: productsTable.id }).from(productsTable)
      .where(and(eq(productsTable.imei, imei), eq(productsTable.id, id))).limit(1);
    if (!existing) {
      const [dup] = await db.select({ id: productsTable.id }).from(productsTable)
        .where(eq(productsTable.imei, imei)).limit(1);
      if (dup) {
        res.status(409).json({ error: `Un autre produit avec l'IMEI ${imei} existe déjà` });
        return;
      }
    }
  }

  const updates: Record<string, unknown> = {};
  if (imei !== undefined) updates.imei = imei || null;
  if (product) updates.product = product;
  if (brand !== undefined) updates.brand = brand || null;
  if (capacity !== undefined) updates.capacity = capacity || null;
  if (color !== undefined) updates.color = color || null;
  if (supplier !== undefined) updates.supplier = supplier || null;
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
    description: `Modification produit: ${row.product}${row.brand ? " " + row.brand : ""} (${row.productId})`,
  });

  res.json(mapProduct(row, isAdmin));
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
    description: `Suppression produit: ${row.product}${row.brand ? " " + row.brand : ""} (${row.productId})`,
  });

  await db.delete(productsTable).where(eq(productsTable.id, id));
  res.status(204).send();
});

export default router;
