import { Router } from "express";
import { db, salesTable, productsTable, clientsTable, movementsTable, sellersTable } from "@workspace/db";
import { eq, ilike, or, and, sql } from "drizzle-orm";
import { requireAuth, requireAdmin } from "../middlewares/auth";
import { formatFCFA_server } from "../utils/format";
import { LOGO_DATA_URI } from "../logo";
import { formatAmountWithWords, numberToWordsFr } from "./sales-invoice-utils.js";

const router = Router();
const saleTypes = ["normal", "troc", "fast_deal"] as const;
const paymentModes = ["OM", "MOMO", "Cash"] as const;
const saleStatuses = ["valides", "annulees"] as const;

type SaleType = typeof saleTypes[number];
type PaymentMode = typeof paymentModes[number];
type SaleStatus = typeof saleStatuses[number];

function nowDateStr() { return new Date().toISOString().split("T")[0]; }
function nowTimeStr() { return new Date().toTimeString().slice(0, 8); }

function escapeHtml(value: string | null | undefined): string {
  if (value == null) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

function saleTypeLabel(type: string | null | undefined): string {
  if (type === "troc") return "Troc";
  if (type === "fast_deal") return "Fast deal";
  return "Vente normale";
}

function isSaleType(value: unknown): value is SaleType {
  return saleTypes.includes(value as SaleType);
}

function isPaymentMode(value: unknown): value is PaymentMode {
  return paymentModes.includes(value as PaymentMode);
}

function isSaleStatus(value: unknown): value is SaleStatus {
  return saleStatuses.includes(value as SaleStatus);
}

function isDateString(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00`));
}

function normalizeTimeString(value: string): string | null {
  if (/^\d{2}:\d{2}$/.test(value)) return `${value}:00`;
  if (/^\d{2}:\d{2}:\d{2}$/.test(value)) return value;
  return null;
}

function formatAmountForMovement(value: unknown): string {
  return `${Number(value).toLocaleString("fr-FR")} FCFA`;
}

async function generateProductId(): Promise<string> {
  const products = await db.select({ productId: productsTable.productId }).from(productsTable).orderBy(productsTable.id);
  const max = products.reduce((acc, p) => {
    const num = parseInt(p.productId.replace("TH", ""), 10);
    return isNaN(num) ? acc : Math.max(acc, num);
  }, 0);
  return `TH${String(max + 1).padStart(3, "0")}`;
}

router.get("/", requireAuth, async (req, res): Promise<void> => {
  const { search, dateFrom, dateTo, paymentMode, productType, status, saleType } = req.query as Record<string, string>;

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
    if (saleType && saleType !== "tous") {
      if (!isSaleType(saleType)) return false;
      if (s.saleType !== saleType) return false;
    }
    if (status && status !== "tous") {
      if (!isSaleStatus(status)) return false;
      if (status === "valides" && s.cancelled) return false;
      if (status === "annulees" && !s.cancelled) return false;
    }
    return true;
  });

  res.json(filtered.sort((a, b) => b.saleDate.localeCompare(a.saleDate) || b.saleTime.localeCompare(a.saleTime)));
});

// Client search for autocomplete (admin only — client directory is admin-restricted)
router.get("/client-search", requireAdmin, async (req, res): Promise<void> => {
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
    vendorId, vendorName, quantitySold = 1, saleDate,
    trocImei, trocProduct, trocBrand, trocCapacity, trocColor, trocHasInvoice,
  } = req.body;

  if (!productId || !saleType || !paymentMode || !amount) {
    res.status(400).json({ error: "Données de vente incomplètes" });
    return;
  }

  const normalizedSaleType = String(saleType);
  if (!isSaleType(normalizedSaleType)) {
    res.status(400).json({ error: "Type de vente invalide" });
    return;
  }
  const normalizedPaymentMode = String(paymentMode);
  if (!isPaymentMode(normalizedPaymentMode)) {
    res.status(400).json({ error: "Mode de paiement invalide" });
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
  if (normalizedSaleType === "troc" && isAccessoire) {
    res.status(400).json({ error: "Le troc n'est pas disponible pour les appareils/accessoires" });
    return;
  }

  const today = nowDateStr();
  const selectedSaleDate = saleDate ? String(saleDate).trim() : today;
  if (!isDateString(selectedSaleDate)) {
    res.status(400).json({ error: "Date de vente invalide" });
    return;
  }
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
  if (normalizedSaleType === "troc" && trocProduct) {
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
      entryDate: selectedSaleDate,
      purchasePrice: trocPurchasePrice !== null ? String(trocPurchasePrice) : null,
      productType: "téléphone",
      quantity: 1,
      entryMethod: "troc",
      createdByUserId: req.session!.userId!,
    }).returning();
    trocProductId = trocRow.id;

    await db.insert(movementsTable).values({
      movementType: "entree_troc",
      movementDate: selectedSaleDate,
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
    saleType: normalizedSaleType,
    paymentMode: normalizedPaymentMode,
    amount: String(amount),
    clientId,
    clientName: clientName || null,
    clientPhone: clientPhone || null,
    sellerId: req.session!.userId!,
    vendorId: resolvedVendorId,
    vendorName: resolvedVendorName,
    saleDate: selectedSaleDate,
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
        saleDate: newQty <= 0 ? selectedSaleDate : undefined,
      })
      .where(eq(productsTable.id, parseInt(productId)));
  } else {
    await db.update(productsTable).set({ status: "vendu", saleDate: selectedSaleDate }).where(eq(productsTable.id, parseInt(productId)));
  }

  await db.insert(movementsTable).values({
    movementType: "vente",
    movementDate: selectedSaleDate,
    movementTime: time,
    userId: req.session!.userId!,
    productId: parseInt(productId),
    productRef: product.productId,
    imei: product.imei,
    description: `Vente ${normalizedSaleType === "troc" ? "(Troc) " : normalizedSaleType === "fast_deal" ? "(Fast deal) " : ""}${product.product}${product.brand ? " " + product.brand : ""}${isAccessoire ? ` x${qty}` : ""} - ${amount} FCFA - ${normalizedPaymentMode}${clientName ? " - " + clientName : ""}${resolvedVendorName ? " (Vendeur: " + resolvedVendorName + ")" : ""}`,
  });

  res.status(201).json({ ...sale, amount: Number(sale.amount) });
});

// PATCH /api/sales/:id - edit sale details (admin + secretary)
router.patch("/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id));
  const currentRole = req.session!.role;
  if (currentRole !== "admin" && currentRole !== "secretary") {
    res.status(403).json({ error: "Vous n'avez pas les droits pour modifier une vente" });
    return;
  }

  const { clientName, clientPhone, vendorId, amount, paymentMode, saleType, saleDate, saleTime } = req.body as {
    clientName?: string | null;
    clientPhone?: string | null;
    vendorId?: number | string | null;
    amount?: number | string | null;
    paymentMode?: string | null;
    saleType?: string | null;
    saleDate?: string | null;
    saleTime?: string | null;
  };

  const [sale] = await db.select().from(salesTable).where(eq(salesTable.id, id)).limit(1);
  if (!sale) { res.status(404).json({ error: "Vente non trouvée" }); return; }
  if (sale.cancelled) { res.status(400).json({ error: "Une vente annulée ne peut pas être modifiée" }); return; }

  const [product] = await db.select().from(productsTable).where(eq(productsTable.id, sale.productId)).limit(1);
  const updates: Partial<typeof salesTable.$inferInsert> = {};
  const changeSummary = [] as string[];

  if (clientName !== undefined) {
    const trimmed = typeof clientName === "string" ? clientName.trim() : "";
    updates.clientName = trimmed || null;
    changeSummary.push(`client: ${sale.clientName || "anonyme"} -> ${updates.clientName || "anonyme"}`);
  }
  if (clientPhone !== undefined) {
    const trimmed = typeof clientPhone === "string" ? clientPhone.trim() : "";
    updates.clientPhone = trimmed || null;
    changeSummary.push(`telephone: ${sale.clientPhone || "-"} -> ${updates.clientPhone || "-"}`);
  }
  if (vendorId !== undefined) {
    if (vendorId === null || vendorId === "" || vendorId === 0 || vendorId === "0") {
      updates.vendorId = null;
      updates.vendorName = null;
    } else {
      const vid = parseInt(String(vendorId));
      if (isNaN(vid) || vid < 0) { res.status(400).json({ error: "Vendeur invalide" }); return; }
      const [vendor] = await db.select().from(sellersTable).where(eq(sellersTable.id, vid)).limit(1);
      if (!vendor) { res.status(400).json({ error: "Vendeur introuvable" }); return; }
      updates.vendorId = vendor.id;
      updates.vendorName = vendor.name;
    }
    changeSummary.push(`vendeur: ${sale.vendorName || "Aucun"} -> ${updates.vendorName || "Aucun"}`);
  }
  if (amount !== undefined) {
    const normalizedAmount = Number(amount);
    if (!Number.isFinite(normalizedAmount) || normalizedAmount <= 0) {
      res.status(400).json({ error: "Montant invalide" });
      return;
    }
    updates.amount = normalizedAmount.toFixed(2);
    changeSummary.push(`montant: ${formatAmountForMovement(sale.amount)} -> ${formatAmountForMovement(normalizedAmount)}`);
  }
  if (paymentMode !== undefined) {
    const normalizedPaymentMode = String(paymentMode || "").trim();
    if (!isPaymentMode(normalizedPaymentMode)) {
      res.status(400).json({ error: "Mode de paiement invalide" });
      return;
    }
    updates.paymentMode = normalizedPaymentMode;
    changeSummary.push(`paiement: ${sale.paymentMode} -> ${normalizedPaymentMode}`);
  }
  if (saleType !== undefined) {
    const normalizedSaleType = String(saleType || "").trim();
    if (!isSaleType(normalizedSaleType)) {
      res.status(400).json({ error: "Type de vente invalide" });
      return;
    }
    if (normalizedSaleType !== sale.saleType && (normalizedSaleType === "troc" || sale.saleType === "troc")) {
      res.status(400).json({ error: "Le type troc ne peut pas etre modifie sur une vente existante" });
      return;
    }
    if (normalizedSaleType === "troc" && product?.productType === "accessoire") {
      res.status(400).json({ error: "Le troc n'est pas disponible pour les accessoires" });
      return;
    }
    updates.saleType = normalizedSaleType;
    changeSummary.push(`type: ${saleTypeLabel(sale.saleType)} -> ${saleTypeLabel(normalizedSaleType)}`);
  }
  if (saleDate !== undefined) {
    const normalizedDate = String(saleDate || "").trim();
    if (!isDateString(normalizedDate)) {
      res.status(400).json({ error: "Date de vente invalide" });
      return;
    }
    updates.saleDate = normalizedDate;
    changeSummary.push(`date: ${sale.saleDate} -> ${normalizedDate}`);
  }
  if (saleTime !== undefined) {
    const normalizedTime = normalizeTimeString(String(saleTime || "").trim());
    if (!normalizedTime) {
      res.status(400).json({ error: "Heure de vente invalide" });
      return;
    }
    updates.saleTime = normalizedTime;
    changeSummary.push(`heure: ${sale.saleTime.substring(0, 5)} -> ${normalizedTime.substring(0, 5)}`);
  }

  if (Object.keys(updates).length === 0) {
    res.status(400).json({ error: "Aucune modification fournie" });
    return;
  }

  const [updated] = await db.update(salesTable).set(updates).where(eq(salesTable.id, id)).returning();

  if (updates.saleDate && product?.status === "vendu") {
    await db.update(productsTable).set({ saleDate: updates.saleDate }).where(eq(productsTable.id, sale.productId));
  }

  await db.insert(movementsTable).values({
    movementType: "modification_produit",
    movementDate: nowDateStr(),
    movementTime: nowTimeStr(),
    userId: req.session!.userId!,
    productId: sale.productId,
    productRef: product?.productId ?? null,
    imei: product?.imei ?? null,
    description: `Modification vente #${id}: ${changeSummary.join(" · ") || "mise à jour"}`,
  });

  res.json({ ...updated, amount: Number(updated.amount) });
});

router.post("/:id/cancel", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id));
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

// GET /api/sales/:id/invoice — HTML invoice for printing
router.get("/:id/invoice", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id));
  const [sale] = await db.select().from(salesTable).where(eq(salesTable.id, id)).limit(1);
  if (!sale) { res.status(404).send("Vente non trouvée"); return; }

  const [product] = await db.select().from(productsTable).where(eq(productsTable.id, sale.productId)).limit(1);

  let trocProduct: typeof product | undefined;
  if (sale.saleType === "troc" && sale.trocProductId) {
    [trocProduct] = await db.select().from(productsTable).where(eq(productsTable.id, sale.trocProductId)).limit(1);
  }

  const formattedDate = new Date(sale.saleDate).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
  const paymentLabel: Record<string, string> = { OM: "Orange Money", MOMO: "Mobile Money", Cash: "Cash / Espèces" };

  const isTroc = sale.saleType === "troc";
  const soldTitle = isTroc ? "📱 Téléphone pris par le client" : "Produit vendu";
  const amountInWords = formatAmountWithWords(Number(sale.amount));
  const trocSection = isTroc && trocProduct ? `
<div class="section">
  <div class="section-title">🔄 Téléphone remis par le client (Troc)</div>
  <table class="product-table">
    <tr>
      <th>Référence</th>
      <th>Désignation</th>
      <th>IMEI</th>
      <th>Capacité</th>
      <th>Couleur</th>
    </tr>
    <tr>
      <td>${escapeHtml(trocProduct.productId) || "—"}</td>
      <td><strong>${escapeHtml(trocProduct.product) || "—"}</strong>${trocProduct.brand ? ` (${escapeHtml(trocProduct.brand)})` : ""}</td>
      <td style="font-family:monospace">${escapeHtml(trocProduct.imei) || "—"}</td>
      <td>${escapeHtml(trocProduct.capacity) || "—"}</td>
      <td>${escapeHtml(trocProduct.color) || "—"}</td>
    </tr>
  </table>
</div>` : "";

  const trocDeclarationSection = isTroc ? `
<div class="section">
  <div class="section-title">📝 Déclaration des parties</div>
  <p style="font-size:13px; line-height:1.7; color:#333; text-align:justify;">
    Nous soussignés, <strong>${escapeHtml(sale.clientName) || "Client anonyme"}</strong> et THE HOMIES, déclarons que l’échange décrit ci-dessus a été effectué librement, volontairement et sans contestation. Les informations relatives au téléphone remis en troc et à la vente effectuée sont exactes et conformes à la réalité.
  </p>
</div>` : "";

  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<title>Facture #${String(id).padStart(5, "0")}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Segoe UI', Arial, sans-serif; color: #1a1a1a; background: white; padding: 40px; max-width: 700px; margin: 0 auto; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #f97316; padding-bottom: 20px; margin-bottom: 24px; }
  .brand-wrap { display: flex; align-items: center; gap: 14px; }
  .logo { height: 60px; width: auto; object-fit: contain; }
  .brand { font-size: 28px; font-weight: 900; color: #f97316; letter-spacing: -1px; }
  .brand-sub { font-size: 12px; color: #666; margin-top: 2px; }
  .invoice-title { text-align: right; }
  .invoice-title h2 { font-size: 22px; font-weight: 700; }
  .invoice-title .num { color: #f97316; font-size: 14px; margin-top: 4px; }
  .invoice-title .date { color: #555; font-size: 13px; margin-top: 2px; }
  .section { margin-bottom: 24px; }
  .section-title { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #888; margin-bottom: 8px; border-bottom: 1px solid #eee; padding-bottom: 4px; }
  .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  .info-block { background: #f8f8f8; border: 1px solid #eee; border-radius: 8px; padding: 14px; }
  .info-label { font-size: 11px; color: #777; margin-bottom: 2px; }
  .info-value { font-size: 15px; font-weight: 600; }
  .product-table { width: 100%; border-collapse: collapse; }
  .product-table th { background: #f97316; color: white; padding: 10px 12px; font-size: 12px; font-weight: 600; text-align: left; }
  .product-table td { padding: 10px 12px; font-size: 13px; border-bottom: 1px solid #f0f0f0; }
  .total-section { background: linear-gradient(135deg, #f97316, #ea580c); color: white; border-radius: 10px; padding: 20px; text-align: right; }
  .total-label { font-size: 13px; opacity: 0.9; }
  .total-amount { font-size: 32px; font-weight: 700; letter-spacing: 0; }
  .amount-words { font-size: 13px; margin-top: 8px; color: white; font-style: italic; }
  .footer { text-align: center; color: #444; font-size: 10.5px; line-height: 1.6; margin-top: 32px; border-top: 1px solid #eee; padding-top: 16px; }
  .footer-title { font-weight: 800; color: #1a1a1a; letter-spacing: 0.2px; }
  .print-button { margin-top: 12px; padding: 8px 20px; background: #f97316; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 13px; font-weight: 600; }
  .badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; }
  .badge-normal { background: #e8f5e9; color: #2e7d32; }
  .badge-troc { background: #fff3e0; color: #e65100; }
  .badge-cancelled { background: #ffebee; color: #c62828; }
  @page { margin: 0; }
  @media print {
    body { padding: 24px; }
    button { display: none; }
  }
</style>
</head>
<body>
<div class="header">
  <div class="brand-wrap">
    <img class="logo" src="${LOGO_DATA_URI}" alt="THE HOMIES" onerror="this.style.display='none'" />
  </div>
  <div class="invoice-title">
    <h2>FACTURE</h2>
    <div class="num">N° ${String(id).padStart(5, "0")}</div>
    <div class="date">📅 ${formattedDate} à ${(sale.saleTime || "").substring(0, 5)}</div>
  </div>
</div>

<div class="section">
  <div class="grid2">
    <div>
      <div class="section-title">Client</div>
      <div class="info-block">
        <div class="info-label">Nom</div>
        <div class="info-value">${escapeHtml(sale.clientName) || "Client anonyme"}</div>
        ${sale.clientPhone ? `<div class="info-label" style="margin-top:8px">Téléphone</div><div class="info-value">${escapeHtml(sale.clientPhone)}</div>` : ""}
      </div>
    </div>
    <div>
      <div class="section-title">Informations vente</div>
      <div class="info-block">
        <div class="info-label">Mode de paiement</div>
        <div class="info-value">${escapeHtml(paymentLabel[sale.paymentMode] || sale.paymentMode)}</div>
        <div class="info-label" style="margin-top:8px">Type</div>
        <div class="info-value">
          <span class="badge ${sale.saleType === "troc" ? "badge-troc" : "badge-normal"}">${sale.saleType === "troc" ? "🔄 Troc" : "✅ Vente normale"}</span>
          ${sale.cancelled ? '<span class="badge badge-cancelled" style="margin-left:4px">❌ Annulée</span>' : ""}
        </div>
        ${sale.vendorName ? `<div class="info-label" style="margin-top:8px">Vendeur</div><div class="info-value">${escapeHtml(sale.vendorName)}</div>` : ""}
      </div>
    </div>
  </div>
</div>

${trocSection}${trocDeclarationSection}
<div class="section">
  <div class="section-title">${soldTitle}</div>
  <table class="product-table">
    <tr>
      <th>Référence</th>
      <th>Désignation</th>
      <th>IMEI</th>
      <th>Capacité</th>
      <th>Couleur</th>
    </tr>
    <tr>
      <td>${escapeHtml(product?.productId) || "—"}</td>
      <td><strong>${escapeHtml(product?.product) || "—"}</strong>${product?.brand ? ` (${escapeHtml(product.brand)})` : ""}</td>
      <td style="font-family:monospace">${escapeHtml(product?.imei) || "—"}</td>
      <td>${escapeHtml(product?.capacity) || "—"}</td>
      <td>${escapeHtml(product?.color) || "—"}</td>
    </tr>
  </table>
</div>

<div class="total-section">
  <div class="total-label">MONTANT TOTAL</div>
  <div class="total-amount">${formatFCFA_server(Number(sale.amount))}</div>
  <div class="amount-words"><strong>Montant en toutes lettres :</strong> ${escapeHtml(amountInWords)}</div>
</div>

<div class="footer">
  <p class="footer-title">VENTE D’APPAREILS ÉLECTRONIQUE & ACCESSOIRES</p>
  <p>Tél. : (+237) 693 39 51 94 / 682 84 51 37 - Situé à : L’École publique Bonamoussadi</p>
  <p>Email : Thehomiescm@gmail.com - NIU: M082518153603G</p>
  <p>Réseaux sociaux : Facebook • TikTok • Instagram • WhatsApp • Snapchat - Site web: TheHomies.cm</p>
  <button class="print-button" onclick="window.print()">🖨️ Imprimer / Enregistrer PDF</button>
</div>
</body>
</html>`;

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(html);
});

export default router;
