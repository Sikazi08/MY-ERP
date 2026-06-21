import { Router } from "express";
import { db, partnersTable, partnerMovementsTable, productsTable, movementsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth, requireAdmin } from "../middlewares/auth";

const router = Router();
function nowDateStr() { return new Date().toISOString().split("T")[0]; }
function nowTimeStr() { return new Date().toTimeString().slice(0, 8); }

router.get("/", requireAuth, async (req, res): Promise<void> => {
  const partners = await db.select().from(partnersTable).orderBy(partnersTable.name);
  res.json(partners);
});

router.post("/", requireAuth, async (req, res): Promise<void> => {
  const { name, phone, address } = req.body;
  if (!name) { res.status(400).json({ error: "Le nom du partenaire est requis" }); return; }
  const [row] = await db.insert(partnersTable).values({ name, phone: phone || null, address: address || null }).returning();
  res.status(201).json(row);
});

router.patch("/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  const { name, phone, address } = req.body;
  const updates: Record<string, unknown> = {};
  if (name) updates.name = name;
  if (phone !== undefined) updates.phone = phone;
  if (address !== undefined) updates.address = address;
  const [row] = await db.update(partnersTable).set(updates).where(eq(partnersTable.id, id)).returning();
  if (!row) { res.status(404).json({ error: "Partenaire non trouvé" }); return; }
  res.json(row);
});

router.delete("/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  await db.delete(partnersTable).where(eq(partnersTable.id, id));
  res.status(204).send();
});

router.post("/send-product", requireAuth, async (req, res): Promise<void> => {
  const { partnerId, productId, movementDate, notes } = req.body;
  if (!partnerId || !productId || !movementDate) {
    res.status(400).json({ error: "Partenaire, produit et date sont requis" });
    return;
  }
  const [product] = await db.select().from(productsTable).where(eq(productsTable.id, parseInt(productId))).limit(1);
  if (!product) { res.status(404).json({ error: "Produit non trouvé" }); return; }
  if (product.status !== "en_stock") { res.status(400).json({ error: "Ce produit n'est pas en stock" }); return; }

  const [partner] = await db.select().from(partnersTable).where(eq(partnersTable.id, parseInt(partnerId))).limit(1);
  if (!partner) { res.status(404).json({ error: "Partenaire non trouvé" }); return; }

  await db.update(productsTable).set({ status: "chez_partenaire" }).where(eq(productsTable.id, parseInt(productId)));
  const [movement] = await db.insert(partnerMovementsTable).values({
    partnerId: parseInt(partnerId),
    productId: parseInt(productId),
    movementType: "sortie",
    movementDate,
    notes: notes || null,
  }).returning();

  await db.insert(movementsTable).values({
    movementType: "sortie_partenaire",
    movementDate: nowDateStr(),
    movementTime: nowTimeStr(),
    userId: req.session!.userId!,
    productId: parseInt(productId),
    productRef: product.productId,
    imei: product.imei,
    description: `Envoi chez partenaire: ${partner.name} - ${product.product} ${product.brand} (${product.productId})`,
  });

  res.status(201).json(movement);
});

router.post("/return-product", requireAuth, async (req, res): Promise<void> => {
  const { productId, movementDate, notes } = req.body;
  if (!productId || !movementDate) {
    res.status(400).json({ error: "Produit et date sont requis" });
    return;
  }
  const [product] = await db.select().from(productsTable).where(eq(productsTable.id, parseInt(productId))).limit(1);
  if (!product) { res.status(404).json({ error: "Produit non trouvé" }); return; }
  if (product.status !== "chez_partenaire") { res.status(400).json({ error: "Ce produit n'est pas chez un partenaire" }); return; }

  const lastSend = await db.select().from(partnerMovementsTable)
    .where(eq(partnerMovementsTable.productId, parseInt(productId)))
    .orderBy(partnerMovementsTable.id);
  const sortie = lastSend.filter(m => m.movementType === "sortie").pop();
  const partnerId = sortie?.partnerId ?? 1;

  const [partner] = await db.select().from(partnersTable).where(eq(partnersTable.id, partnerId)).limit(1);

  await db.update(productsTable).set({ status: "en_stock" }).where(eq(productsTable.id, parseInt(productId)));
  const [movement] = await db.insert(partnerMovementsTable).values({
    partnerId,
    productId: parseInt(productId),
    movementType: "retour",
    movementDate,
    notes: notes || null,
  }).returning();

  await db.insert(movementsTable).values({
    movementType: "retour_partenaire",
    movementDate: nowDateStr(),
    movementTime: nowTimeStr(),
    userId: req.session!.userId!,
    productId: parseInt(productId),
    productRef: product.productId,
    imei: product.imei,
    description: `Retour partenaire${partner ? ": " + partner.name : ""} - ${product.product} ${product.brand} (${product.productId})`,
  });

  res.json(movement);
});

router.get("/movements", requireAuth, async (req, res): Promise<void> => {
  const rows = await db.select().from(partnerMovementsTable)
    .leftJoin(partnersTable, eq(partnerMovementsTable.partnerId, partnersTable.id))
    .leftJoin(productsTable, eq(partnerMovementsTable.productId, productsTable.id))
    .orderBy(partnerMovementsTable.id);

  res.json(rows.map(r => ({
    ...r.partner_movements,
    partner: r.partners,
    product: r.products ? {
      ...r.products,
      purchasePrice: undefined,
      sellingPrice: r.products.sellingPrice !== null ? Number(r.products.sellingPrice) : null,
    } : null,
  })));
});

export default router;
