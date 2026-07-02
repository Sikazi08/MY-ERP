import { Router } from "express";
import { db, productsTable, movementsTable, partnerMovementsTable, partnersTable } from "@workspace/db";
import { eq, ne, ilike, or, and, gte, lte, inArray, sql } from "drizzle-orm";
import { requireAuth, requireAdmin } from "../middlewares/auth";
import multer from "multer";
import ExcelJS from "exceljs";
import { Readable } from "stream";

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

function cleanText(value: unknown): string | null {
  const text = String(value ?? "").trim();
  return text || null;
}

function normalizeIdentity(value: unknown): string {
  return String(value ?? "").trim().toLowerCase();
}

function isUniqueViolation(error: unknown): boolean {
  return (error as { code?: string })?.code === "23505";
}

function isAccessoryDuplicateIndex(error: unknown): boolean {
  return String((error as { constraint?: string })?.constraint ?? "").includes("products_unique_active_accessory_identity");
}

function isPhoneImeiIndex(error: unknown): boolean {
  return String((error as { constraint?: string })?.constraint ?? "").includes("products_unique_phone_imei");
}

async function findActiveAccessoryDuplicate(values: { product: unknown; brand?: unknown; capacity?: unknown; color?: unknown }) {
  const [row] = await db.select().from(productsTable).where(and(
    eq(productsTable.productType, "accessoire"),
    ne(productsTable.quantity, 0),
    sql`lower(trim(${productsTable.product})) = ${normalizeIdentity(values.product)}`,
    sql`coalesce(lower(trim(${productsTable.brand})), '') = ${normalizeIdentity(values.brand)}`,
    sql`coalesce(lower(trim(${productsTable.capacity})), '') = ${normalizeIdentity(values.capacity)}`,
    sql`coalesce(lower(trim(${productsTable.color})), '') = ${normalizeIdentity(values.color)}`,
  )).limit(1);
  return row;
}

function mapProduct(p: typeof productsTable.$inferSelect, isAdmin: boolean, partnerName?: string | null) {
  return {
    ...p,
    brand: p.brand || null,
    phoneState: p.phoneState || null,
    individualName: p.individualName || null,
    individualPhone: p.individualPhone || null,
    purchasePrice: isAdmin ? (p.purchasePrice !== null ? Number(p.purchasePrice) : null) : undefined,
    sellingPrice: p.sellingPrice !== null ? Number(p.sellingPrice) : null,
    profit: isAdmin && p.purchasePrice !== null && p.sellingPrice !== null
      ? Number(p.sellingPrice) - Number(p.purchasePrice)
      : null,
    partnerName: partnerName || null,
    productType: p.productType || "téléphone",
    quantity: p.quantity ?? 1,
    entryMethod: p.entryMethod || "achat",
  };
}

async function getPartnerNames(rows: typeof productsTable.$inferSelect[]): Promise<Map<number, string>> {
  const chezIds = rows.filter(p => p.status === "chez_partenaire").map(p => p.id);
  const partnerNameMap = new Map<number, string>();
  if (chezIds.length === 0) return partnerNameMap;

  const movements = await db.select({
    productId: partnerMovementsTable.productId,
    partnerName: partnersTable.name,
    movId: partnerMovementsTable.id,
  }).from(partnerMovementsTable)
    .leftJoin(partnersTable, eq(partnerMovementsTable.partnerId, partnersTable.id))
    .where(and(
      inArray(partnerMovementsTable.productId, chezIds),
      eq(partnerMovementsTable.movementType, "sortie"),
    ));

  for (const m of movements) {
    if (m.partnerName) partnerNameMap.set(m.productId, m.partnerName);
  }
  return partnerNameMap;
}

router.get("/", requireAuth, async (req, res): Promise<void> => {
  const { status, search, dateFrom, dateTo, page, limit, productType } = req.query as Record<string, string>;
  const conditions = [];
  conditions.push(ne(productsTable.quantity, 0));
  if (status && status !== "tous") conditions.push(eq(productsTable.status, status as "en_stock" | "chez_partenaire" | "vendu"));
  if (productType && productType !== "tous") conditions.push(eq(productsTable.productType, productType));
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
        ilike(productsTable.individualName, `%${search}%`),
        ilike(productsTable.individualPhone, `%${search}%`),
      )
    );
  }
  const rows = conditions.length > 0
    ? await db.select().from(productsTable).where(and(...conditions)).orderBy(productsTable.id)
    : await db.select().from(productsTable).orderBy(productsTable.id);

  const isAdmin = req.session!.role === "admin";
  const partnerNames = await getPartnerNames(rows);

  const pageNum = parseInt(page || "1");
  const limitNum = parseInt(limit || "25");
  const total = rows.length;
  const paginated = rows.slice((pageNum - 1) * limitNum, pageNum * limitNum);

  res.json({
    data: paginated.map(p => mapProduct(p, isAdmin, partnerNames.get(p.id))),
    total,
    page: pageNum,
    limit: limitNum,
  });
});

router.post("/", requireAuth, async (req, res): Promise<void> => {
  const {
    imei, product, brand, capacity, color, phoneState, supplier, individualName, individualPhone,
    purchasePrice, sellingPrice, status, entryDate,
    productType = "téléphone", quantity = 1, entryMethod = "achat",
  } = req.body;

  if (!product || !entryDate) {
    res.status(400).json({ error: "Nom du produit et date d'entrée sont requis" });
    return;
  }

  const isAdmin = req.session!.role === "admin";
  const normalizedProductType = productType === "accessoire" ? "accessoire" : "téléphone";
  const trimmedImei = cleanText(imei);
  const selectedEntryMethod = cleanText(entryMethod) || "achat";
  const allowedPhoneEntryMethods = ["achat", "partenaire", "particulier"];

  if (normalizedProductType === "téléphone" && !allowedPhoneEntryMethods.includes(selectedEntryMethod)) {
    res.status(400).json({ error: "Veuillez choisir un type d'entrée valide" });
    return;
  }

  if (normalizedProductType === "téléphone" && selectedEntryMethod === "particulier" && (!cleanText(individualName) || !cleanText(individualPhone))) {
    res.status(400).json({ error: "Nom et numéro du particulier sont requis" });
    return;
  }

  if (normalizedProductType === "téléphone" && trimmedImei) {
    const [existing] = await db.select({ id: productsTable.id }).from(productsTable).where(eq(productsTable.imei, trimmedImei)).limit(1);
    if (existing) {
      res.status(409).json({ error: "Ce téléphone existe déjà en stock (IMEI déjà enregistré).", code: "DUPLICATE_IMEI" });
      return;
    }
  }

  if (normalizedProductType === "accessoire") {
    const duplicate = await findActiveAccessoryDuplicate({ product, brand, capacity, color });
    if (duplicate) {
      res.status(409).json({
        error: "Cet accessoire existe déjà en stock. Souhaitez-vous simplement ajouter cette quantité au stock existant ?",
        code: "DUPLICATE_ACCESSORY",
        existingProductId: duplicate.id,
        existingProduct: mapProduct(duplicate, isAdmin),
      });
      return;
    }
  }

  const productId = await generateProductId();
  const finalQuantity = normalizedProductType === "téléphone" ? 1 : Math.max(1, parseInt(String(quantity)) || 1);

  let row: typeof productsTable.$inferSelect;
  try {
    [row] = await db.insert(productsTable).values({
      productId,
      imei: normalizedProductType === "téléphone" ? trimmedImei : null,
      product: cleanText(product)!,
      brand: cleanText(brand),
      capacity: cleanText(capacity),
      color: cleanText(color),
      phoneState: normalizedProductType === "téléphone" ? cleanText(phoneState) : null,
      supplier: selectedEntryMethod === "particulier" ? null : cleanText(supplier),
      individualName: selectedEntryMethod === "particulier" ? cleanText(individualName) : null,
      individualPhone: selectedEntryMethod === "particulier" ? cleanText(individualPhone) : null,
      purchasePrice: isAdmin && purchasePrice !== undefined && purchasePrice !== "" ? String(purchasePrice) : null,
      sellingPrice: sellingPrice !== undefined && sellingPrice !== "" ? String(sellingPrice) : null,
      status: status || "en_stock",
      entryDate,
      productType: normalizedProductType,
      quantity: finalQuantity,
      entryMethod: normalizedProductType === "téléphone" ? selectedEntryMethod : null,
      createdByUserId: req.session!.userId!,
    }).returning();
  } catch (error) {
    if (isUniqueViolation(error) && (isPhoneImeiIndex(error) || normalizedProductType === "téléphone")) {
      res.status(409).json({ error: "Ce téléphone existe déjà en stock (IMEI déjà enregistré).", code: "DUPLICATE_IMEI" });
      return;
    }
    if (isUniqueViolation(error) && (isAccessoryDuplicateIndex(error) || normalizedProductType === "accessoire")) {
      const duplicate = await findActiveAccessoryDuplicate({ product, brand, capacity, color });
      res.status(409).json({
        error: "Cet accessoire existe déjà en stock. Souhaitez-vous simplement ajouter cette quantité au stock existant ?",
        code: "DUPLICATE_ACCESSORY",
        existingProductId: duplicate?.id,
        existingProduct: duplicate ? mapProduct(duplicate, isAdmin) : null,
      });
      return;
    }
    throw error;
  }

  await db.insert(movementsTable).values({
    movementType: "achat",
    movementDate: nowDateStr(),
    movementTime: nowTimeStr(),
    userId: req.session!.userId!,
    productId: row.id,
    productRef: row.productId,
    imei: row.imei,
    description: `Ajout ${normalizedProductType === "accessoire" ? "accessoire" : "téléphone"}${normalizedProductType === "téléphone" ? ` (${selectedEntryMethod})` : ""}: ${product}${brand ? " " + brand : ""} (${productId})${finalQuantity > 1 ? ` — Qté: ${finalQuantity}` : ""}`,
  });

  res.status(201).json(mapProduct(row, isAdmin));
});

router.post("/:id/add-quantity", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id));
  const quantityToAdd = Math.max(1, parseInt(String(req.body?.quantity ?? "1")) || 1);
  const isAdmin = req.session!.role === "admin";

  const [existing] = await db.select().from(productsTable).where(eq(productsTable.id, id)).limit(1);
  if (!existing) { res.status(404).json({ error: "Produit non trouvé" }); return; }
  if (existing.productType !== "accessoire") {
    res.status(400).json({ error: "Cette opération est réservée aux accessoires" });
    return;
  }

  const [row] = await db.update(productsTable)
    .set({ quantity: sql`${productsTable.quantity} + ${quantityToAdd}`, status: "en_stock" })
    .where(eq(productsTable.id, id))
    .returning();

  await db.insert(movementsTable).values({
    movementType: "achat",
    movementDate: nowDateStr(),
    movementTime: nowTimeStr(),
    userId: req.session!.userId!,
    productId: row.id,
    productRef: row.productId,
    imei: row.imei,
    description: `Réapprovisionnement accessoire: ${row.product}${row.brand ? " " + row.brand : ""} (${row.productId}) — Qté ajoutée: ${quantityToAdd}`,
  });

  res.json(mapProduct(row, isAdmin));
});

router.get("/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id));
  const [row] = await db.select().from(productsTable).where(eq(productsTable.id, id)).limit(1);
  if (!row) { res.status(404).json({ error: "Produit non trouvé" }); return; }
  const isAdmin = req.session!.role === "admin";
  const partnerNames = await getPartnerNames([row]);
  res.json(mapProduct(row, isAdmin, partnerNames.get(row.id)));
});

router.patch("/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id));
  const role = req.session!.role;
  const isAdmin = role === "admin";
  const isSecretary = role === "secretary";
  if (!isAdmin && !isSecretary) {
    res.status(403).json({ error: "Vous n'avez pas les droits pour modifier un produit" });
    return;
  }

  const [existing] = await db.select().from(productsTable).where(eq(productsTable.id, id)).limit(1);
  if (!existing) { res.status(404).json({ error: "Produit non trouvé" }); return; }

  const { imei, product, brand, capacity, color, phoneState, supplier, individualName, individualPhone, purchasePrice, sellingPrice, status, entryDate, quantity, entryMethod } = req.body;

  if (!isAdmin && purchasePrice !== undefined) {
    res.status(403).json({ error: "Seul l'admin peut modifier le prix d'achat" });
    return;
  }

  if (imei && imei !== existing.imei) {
    const [dup] = await db.select({ id: productsTable.id }).from(productsTable)
      .where(eq(productsTable.imei, imei)).limit(1);
    if (dup) {
      res.status(409).json({ error: "Ce téléphone existe déjà en stock (IMEI déjà enregistré)." });
      return;
    }
  }

  const updates: Record<string, unknown> = {};
  if (imei !== undefined) updates.imei = imei || null;
  if (product) updates.product = product;
  if (brand !== undefined) updates.brand = brand || null;
  if (capacity !== undefined) updates.capacity = capacity || null;
  if (color !== undefined) updates.color = color || null;
  if (phoneState !== undefined) updates.phoneState = phoneState || null;
  if (supplier !== undefined) updates.supplier = supplier || null;
  if (individualName !== undefined) updates.individualName = individualName || null;
  if (individualPhone !== undefined) updates.individualPhone = individualPhone || null;
  if (isAdmin && purchasePrice !== undefined) updates.purchasePrice = purchasePrice !== "" ? String(purchasePrice) : null;
  if (sellingPrice !== undefined) updates.sellingPrice = sellingPrice !== "" ? String(sellingPrice) : null;
  if (status) updates.status = status;
  if (entryDate) updates.entryDate = entryDate;
  if (quantity !== undefined && existing.productType === "accessoire") updates.quantity = parseInt(String(quantity)) || 1;
  if (entryMethod !== undefined) updates.entryMethod = entryMethod || null;

  const [row] = await db.update(productsTable).set(updates).where(eq(productsTable.id, id)).returning();

  await db.insert(movementsTable).values({
    movementType: "modification_produit",
    movementDate: nowDateStr(),
    movementTime: nowTimeStr(),
    userId: req.session!.userId!,
    productId: row.id,
    productRef: row.productId,
    imei: row.imei,
    description: `Modification produit ${row.product}${row.brand ? " " + row.brand : ""} (${row.productId}) par ${isAdmin ? "admin" : "secrétaire"}`,
  });

  res.json(mapProduct(row, isAdmin));
});

router.delete("/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id));
  const role = req.session!.role;
  const isAdmin = role === "admin";
  const isSecretary = role === "secretary";
  const reason = String(req.body?.reason ?? "").trim();

  if (!isAdmin && !isSecretary) {
    res.status(403).json({ error: "Acces refuse" });
    return;
  }
  if (!reason) {
    res.status(400).json({ error: "Le motif de suppression est requis" });
    return;
  }

  const [row] = await db.select().from(productsTable).where(eq(productsTable.id, id)).limit(1);
  if (!row) { res.status(404).json({ error: "Produit non trouvé" }); return; }

  if (row.status === "vendu") {
    res.status(400).json({ error: "Un produit vendu doit etre gere depuis sa vente" });
    return;
  }
  if ((row.quantity ?? 0) <= 0) {
    res.status(400).json({ error: "Ce produit est deja supprime du stock" });
    return;
  }

  await db.update(productsTable).set({ quantity: 0 }).where(eq(productsTable.id, id));
  await db.insert(movementsTable).values({
    movementType: "suppression_produit",
    movementDate: nowDateStr(),
    movementTime: nowTimeStr(),
    userId: req.session!.userId!,
    productId: row.id,
    productRef: row.productId,
    imei: row.imei,
    description: `Suppression stock: ${row.product}${row.brand ? " " + row.brand : ""} (${row.productId}) - Motif: ${reason}`,
  });

  res.status(204).send();
});

// POST /api/products/import — bulk import from CSV/Excel (admin only)
const uploadMiddleware = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });
router.post("/import", requireAdmin, uploadMiddleware.single("file"), async (req, res): Promise<void> => {
  if (!req.file) { res.status(400).json({ error: "Fichier requis (.xlsx ou .csv)" }); return; }

  let rows: Record<string, unknown>[] = [];
  try {
    const wb = new ExcelJS.Workbook();
    const isCSV = /\.(csv)$/i.test(req.file.originalname) || req.file.mimetype === "text/csv";
    if (isCSV) {
      await wb.csv.read(Readable.from(req.file.buffer));
    } else {
      await wb.xlsx.load(req.file.buffer as any);
    }
    const ws = wb.worksheets[0];
    const headers: string[] = [];
    ws.getRow(1).eachCell((cell, col) => { headers[col] = String(cell.value ?? ""); });
    ws.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      const obj: Record<string, unknown> = {};
      row.eachCell((cell, col) => { const h = headers[col]; if (h) obj[h] = cell.value; });
      rows.push(obj);
    });
  } catch {
    res.status(400).json({ error: "Impossible de lire le fichier. Vérifiez le format (.xlsx ou .csv)" });
    return;
  }

  const today = new Date().toISOString().split("T")[0];
  const time = new Date().toTimeString().slice(0, 8);
  let imported = 0;
  const errors: string[] = [];

  // Get current max product id
  const allProds = await db.select({ productId: productsTable.productId }).from(productsTable).orderBy(productsTable.id);
  let maxId = allProds.reduce((acc, p) => {
    const num = parseInt(p.productId.replace("TH", ""), 10);
    return isNaN(num) ? acc : Math.max(acc, num);
  }, 0);

  for (const [i, row] of rows.entries()) {
    const product = String(row["Produit"] || row["product"] || row["Nom"] || "").trim();
    if (!product) { errors.push(`Ligne ${i + 2}: Nom du produit manquant`); continue; }

    const imei = String(row["IMEI"] || row["imei"] || "").trim() || null;
    // Check IMEI uniqueness
    if (imei) {
      const [dup] = await db.select({ id: productsTable.id }).from(productsTable).where(eq(productsTable.imei, imei)).limit(1);
      if (dup) { errors.push(`Ligne ${i + 2}: IMEI ${imei} déjà présent`); continue; }
    }

    const productType = String(row["Type"] || row["type"] || row["productType"] || "téléphone").toLowerCase().includes("acc") ? "accessoire" : "téléphone";
    const brand = String(row["Marque"] || row["brand"] || "").trim() || null;
    const capacity = String(row["Capacité"] || row["capacity"] || "").trim() || null;
    const color = String(row["Couleur"] || row["color"] || "").trim() || null;
    const supplier = String(row["Fournisseur"] || row["supplier"] || "").trim() || null;
    const entryDate = String(row["Date"] || row["date"] || row["entryDate"] || today).trim() || today;
    const quantity = parseInt(String(row["Quantité"] || row["quantity"] || "1")) || 1;
    const entryMethod = String(row["Méthode"] || row["entryMethod"] || "achat").toLowerCase().includes("troc") ? "troc" : "achat";
    const sellingPrice = parseFloat(String(row["PV"] || row["Prix Vente"] || row["sellingPrice"] || "")) || null;
    const purchasePrice = parseFloat(String(row["PA"] || row["Prix Achat"] || row["purchasePrice"] || "")) || null;
    const status = String(row["Statut"] || row["status"] || "en_stock").includes("partenaire") ? "chez_partenaire" : "en_stock";

    maxId++;
    const productId = `TH${String(maxId).padStart(3, "0")}`;

    try {
      const [row2] = await db.insert(productsTable).values({
        productId, imei, product, brand, capacity, color, supplier,
        purchasePrice: purchasePrice !== null ? String(purchasePrice) : null,
        sellingPrice: sellingPrice !== null ? String(sellingPrice) : null,
        status,
        entryDate,
        productType,
        quantity: productType === "accessoire" ? Math.max(1, quantity) : 1,
        entryMethod: productType === "téléphone" ? entryMethod : null,
        createdByUserId: req.session!.userId!,
      }).returning();

      await db.insert(movementsTable).values({
        movementType: "achat",
        movementDate: today,
        movementTime: time,
        userId: req.session!.userId!,
        productId: row2.id,
        productRef: row2.productId,
        imei: row2.imei,
        description: `Import: ${product}${brand ? " " + brand : ""} (${productId})`,
      });
      imported++;
    } catch (e) {
      errors.push(`Ligne ${i + 2}: Erreur lors de l'insertion`);
    }
  }

  res.json({ imported, total: rows.length, errors });
});

export default router;
