import { Router } from "express";
import { db, salesTable, productsTable, clientsTable, movementsTable, sellersTable } from "@workspace/db";
import { eq, ilike, or, and, sql } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";

const router = Router();

function nowDateStr() { return new Date().toISOString().split("T")[0]; }
function nowTimeStr() { return new Date().toTimeString().slice(0, 8); }

async function generateProductId(): Promise<string> {
  const products = await db.select({ productId: productsTable.productId }).from(productsTable).orderBy(productsTable.id);
  const max = products.reduce((acc, p) => {
    const num = parseInt(p.productId.replace("TH", ""), 10);
    return isNaN(num) ? acc : Math.max(acc, num);
  }, 0);
  return `TH${String(max + 1).padStart(3, "0")}`;
}

router.get("/", requireAuth, async (req, res): Promise<void> => {
  const { search, dateFrom, dateTo, paymentMode, productType } = req.query as Record<string, string>;

  const rows = await db.select().from(salesTable)
    .leftJoin(productsTable, eq(salesTable.productId, productsTable.id))
    .orderBy(salesTable.saleDate);

  const isAdmin = req.session!.role === "admin";

  const mapped = rows.map(r => ({
    ...r.sales,
    amount: Number(r.sales.amount),
    quantitySold: r.sales.quantitySold ?? 1,
    product: r.products ? {
      ...r.products,
      purchasePrice: isAdmin ? (r.products.purchasePrice !== null ? Number(r.products.purchasePrice) : null) : undefined,
      sellingPrice: r.products.sellingPrice !== null ? Number(r.products.sellingPrice) : null,
      profit: isAdmin && r.products.purchasePrice !== null && r.products.sellingPrice !== null
        ? Number(r.products.sellingPrice) - Number(r.products.purchasePrice) : null,
      productType: r.products.productType || "téléphone",
    } : null,
  }));

  const filtered = mapped.filter(s => {
    if (productType && productType !== "tous") {
      if (s.product?.productType !== productType) return false;
    }
    if (search) {
      const q = search.toLowerCase();
      const match = (
        s.clientName?.toLowerCase().includes(q) ||
        s.clientPhone?.toLowerCase().includes(q) ||
        s.vendorName?.toLowerCase().includes(q) ||
        s.product?.imei?.toLowerCase().includes(q) ||
        s.product?.product?.toLowerCase().includes(q) ||
        s.product?.productId?.toLowerCase().includes(q)
      );
      if (!match) return false;
    }
    if (dateFrom && s.saleDate < dateFrom) return false;
    if (dateTo && s.saleDate > dateTo) return false;
    if (paymentMode && s.paymentMode !== paymentMode) return false;
    return true;
  });

  res.json(filtered.sort((a, b) => b.saleDate.localeCompare(a.saleDate) || b.saleTime.localeCompare(a.saleTime)));
});

// Client search for autocomplete (accessible to all authenticated users)
router.get("/client-search", requireAuth, async (req, res): Promise<void> => {
  const { q } = req.query as Record<string, string>;
  if (!q || q.length < 2) { res.json([]); return; }
  const clients = await db.select({ id: clientsTable.id, fullName: clientsTable.fullName, phone: clientsTable.phone })
    .from(clientsTable)
    .where(or(ilike(clientsTable.fullName, `%${q}%`), ilike(clientsTable.phone, `%${q}%`)))
    .limit(8);
  res.json(clients);
});

router.post("/", requireAuth, async (req, res): Promise<void> => {
  const {
    productId, saleType, paymentMode, amount, clientName, clientPhone,
    vendorId, vendorName, quantitySold = 1,
    trocImei, trocProduct, trocBrand, trocCapacity, trocColor, trocHasInvoice,
  } = req.body;

  if (!productId || !saleType || !paymentMode || !amount) {
    res.status(400).json({ error: "Données de vente incomplètes" });
    return;
  }

  const [product] = await db.select().from(productsTable).where(eq(productsTable.id, parseInt(productId))).limit(1);
  if (!product) { res.status(404).json({ error: "Produit non trouvé" }); return; }
  if (product.status === "vendu") { res.status(400).json({ error: "Ce produit est déjà vendu" }); return; }

  const isAccessoire = product.productType === "accessoire";
  const qty = isAccessoire ? Math.max(1, parseInt(String(quantitySold)) || 1) : 1;

  if (isAccessoire && qty > (product.quantity ?? 1)) {
    res.status(400).json({ error: `Quantité insuffisante. Stock disponible: ${product.quantity}` });
    return;
  }

  // Troc only allowed for phones
  if (saleType === "troc" && isAccessoire) {
    res.status(400).json({ error: "Le troc n'est pas disponible pour les appareils/accessoires" });
    return;
  }

  const today = nowDateStr();
  const time = nowTimeStr();

  let clientId: number | null = null;
  if (clientName || clientPhone) {
    const [existing] = await db.select().from(clientsTable).where(
      clientPhone ? eq(clientsTable.phone, clientPhone) : ilike(clientsTable.fullName, clientName!)
    ).limit(1);
    if (existing) {
      clientId = existing.id;
    } else {
      const [newClient] = await db.insert(clientsTable).values({
        fullName: clientName || "Client anonyme",
        phone: clientPhone || null,
      }).returning();
      clientId = newClient.id;
    }
  }

  let resolvedVendorName: string | null = vendorName || null;
  let resolvedVendorId: number | null = null;

  if (vendorId) {
    const [vendor] = await db.select().from(sellersTable).where(eq(sellersTable.id, parseInt(vendorId))).limit(1);
    if (vendor) {
      resolvedVendorId = vendor.id;
      resolvedVendorName = vendor.name;
    }
  }

  let trocProductId: number | null = null;
  if (saleType === "troc" && trocProduct) {
    const trocProdId = await generateProductId();
    const trocPurchasePrice = product.sellingPrice !== null
      ? Math.max(0, Number(product.sellingPrice) - Number(amount))
      : null;

    const [trocRow] = await db.insert(productsTable).values({
      productId: trocProdId,
      imei: trocImei || null,
      product: trocProduct,
      brand: trocBrand || null,
      capacity: trocCapacity || null,
      color: trocColor || null,
      status: "en_stock",
      entryDate: today,
      purchasePrice: trocPurchasePrice !== null ? String(trocPurchasePrice) : null,
      productType: "téléphone",
      quantity: 1,
      entryMethod: "troc",
      createdByUserId: req.session!.userId!,
    }).returning();
    trocProductId = trocRow.id;

    await db.insert(movementsTable).values({
      movementType: "entree_troc",
      movementDate: today,
      movementTime: time,
      userId: req.session!.userId!,
      productId: trocRow.id,
      productRef: trocRow.productId,
      imei: trocRow.imei,
      description: `Entrée troc: ${trocProduct}${trocBrand ? " " + trocBrand : ""} (${trocProdId})${trocPurchasePrice !== null ? ` — PA: ${trocPurchasePrice} FCFA` : ""}${trocHasInvoice ? " [Facture remise]" : ""}`,
    });
  }

  const [sale] = await db.insert(salesTable).values({
    productId: parseInt(productId),
    saleType,
    paymentMode,
    amount: String(amount),
    clientId,
    clientName: clientName || null,
    clientPhone: clientPhone || null,
    sellerId: req.session!.userId!,
    vendorId: resolvedVendorId,
    vendorName: resolvedVendorName,
    saleDate: today,
    saleTime: time,
    cancelled: false,
    trocProductId,
    quantitySold: qty,
  }).returning();

  // For accessories: decrement quantity, mark as vendu only when qty reaches 0
  if (isAccessoire) {
    const newQty = (product.quantity ?? 1) - qty;
    await db.update(productsTable)
      .set({
        quantity: Math.max(0, newQty),
        status: newQty <= 0 ? "vendu" : "en_stock",
        saleDate: newQty <= 0 ? today : undefined,
      })
      .where(eq(productsTable.id, parseInt(productId)));
  } else {
    await db.update(productsTable).set({ status: "vendu", saleDate: today }).where(eq(productsTable.id, parseInt(productId)));
  }

  await db.insert(movementsTable).values({
    movementType: "vente",
    movementDate: today,
    movementTime: time,
    userId: req.session!.userId!,
    productId: parseInt(productId),
    productRef: product.productId,
    imei: product.imei,
    description: `Vente ${saleType === "troc" ? "(Troc) " : ""}${product.product}${product.brand ? " " + product.brand : ""}${isAccessoire ? ` x${qty}` : ""} - ${amount} FCFA - ${paymentMode}${clientName ? " - " + clientName : ""}${resolvedVendorName ? " (Vendeur: " + resolvedVendorName + ")" : ""}`,
  });

  res.status(201).json({ ...sale, amount: Number(sale.amount) });
});

router.post("/:id/cancel", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  const { reason } = req.body;
  if (!reason) { res.status(400).json({ error: "La raison d'annulation est requise" }); return; }

  const [sale] = await db.select().from(salesTable).where(eq(salesTable.id, id)).limit(1);
  if (!sale) { res.status(404).json({ error: "Vente non trouvée" }); return; }
  if (sale.cancelled) { res.status(400).json({ error: "Cette vente est déjà annulée" }); return; }

  const [updated] = await db.update(salesTable).set({ cancelled: true, cancellationReason: reason }).where(eq(salesTable.id, id)).returning();

  const [product] = await db.select().from(productsTable).where(eq(productsTable.id, sale.productId)).limit(1);
  if (product) {
    if (product.productType === "accessoire") {
      const restoredQty = (product.quantity ?? 0) + (sale.quantitySold ?? 1);
      await db.update(productsTable).set({ quantity: restoredQty, status: "en_stock", saleDate: null }).where(eq(productsTable.id, sale.productId));
    } else {
      await db.update(productsTable).set({ status: "en_stock", saleDate: null }).where(eq(productsTable.id, sale.productId));
    }
  }

  await db.insert(movementsTable).values({
    movementType: "annulation",
    movementDate: nowDateStr(),
    movementTime: nowTimeStr(),
    userId: req.session!.userId!,
    productId: sale.productId,
    description: `Annulation vente #${id}: ${reason}`,
  });

  res.json({ ...updated, amount: Number(updated.amount) });
});

export default router;
