import { Router } from "express";
import { db, salesTable, productsTable, clientsTable, movementsTable, sellersTable } from "@workspace/db";
import { eq, ilike, and } from "drizzle-orm";
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
  const { search, dateFrom, dateTo, paymentMode } = req.query as Record<string, string>;

  const rows = await db.select().from(salesTable)
    .leftJoin(productsTable, eq(salesTable.productId, productsTable.id))
    .orderBy(salesTable.saleDate);

  const isAdmin = req.session!.role === "admin";

  const mapped = rows.map(r => ({
    ...r.sales,
    amount: Number(r.sales.amount),
    product: r.products ? {
      ...r.products,
      purchasePrice: isAdmin ? (r.products.purchasePrice !== null ? Number(r.products.purchasePrice) : null) : undefined,
      sellingPrice: r.products.sellingPrice !== null ? Number(r.products.sellingPrice) : null,
      profit: isAdmin && r.products.purchasePrice !== null && r.products.sellingPrice !== null
        ? Number(r.products.sellingPrice) - Number(r.products.purchasePrice) : null,
    } : null,
  }));

  const filtered = mapped.filter(s => {
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

router.post("/", requireAuth, async (req, res): Promise<void> => {
  const { productId, saleType, paymentMode, amount, clientName, clientPhone,
    vendorId, vendorName,
    trocImei, trocProduct, trocBrand, trocCapacity, trocColor } = req.body;

  if (!productId || !saleType || !paymentMode || !amount) {
    res.status(400).json({ error: "Données de vente incomplètes" });
    return;
  }

  const [product] = await db.select().from(productsTable).where(eq(productsTable.id, parseInt(productId))).limit(1);
  if (!product) { res.status(404).json({ error: "Produit non trouvé" }); return; }
  if (product.status === "vendu") { res.status(400).json({ error: "Ce produit est déjà vendu" }); return; }

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

  let resolvedVendorName: string | null = null;
  let resolvedVendorId: number | null = null;

  if (vendorId) {
    const [vendor] = await db.select().from(sellersTable).where(eq(sellersTable.id, parseInt(vendorId))).limit(1);
    if (vendor) {
      resolvedVendorId = vendor.id;
      resolvedVendorName = vendor.name;
    }
  } else if (vendorName) {
    resolvedVendorName = vendorName;
  }

  let trocProductId: number | null = null;
  if (saleType === "troc" && trocProduct) {
    const trocProdId = await generateProductId();
    const [trocRow] = await db.insert(productsTable).values({
      productId: trocProdId,
      imei: trocImei || null,
      product: trocProduct,
      brand: trocBrand || null,
      capacity: trocCapacity || null,
      color: trocColor || null,
      status: "en_stock",
      entryDate: today,
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
      description: `Entrée troc: ${trocProduct}${trocBrand ? " " + trocBrand : ""} (${trocProdId})`,
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
  }).returning();

  await db.update(productsTable).set({ status: "vendu", saleDate: today }).where(eq(productsTable.id, parseInt(productId)));

  await db.insert(movementsTable).values({
    movementType: "vente",
    movementDate: today,
    movementTime: time,
    userId: req.session!.userId!,
    productId: parseInt(productId),
    productRef: product.productId,
    imei: product.imei,
    description: `Vente ${saleType === "troc" ? "(Troc) " : ""}${product.product}${product.brand ? " " + product.brand : ""} - ${amount} FCFA - ${paymentMode}${clientName ? " - " + clientName : ""}${resolvedVendorName ? " (Vendeur: " + resolvedVendorName + ")" : ""}`,
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

  await db.update(productsTable).set({ status: "en_stock", saleDate: null }).where(eq(productsTable.id, sale.productId));

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
