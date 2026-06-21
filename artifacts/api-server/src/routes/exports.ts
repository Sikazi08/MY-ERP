import { Router } from "express";
import * as XLSX from "xlsx";
import { db, productsTable, salesTable, expensesTable, clientsTable, movementsTable, usersTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { requireAuth, requireAdmin } from "../middlewares/auth";

const router = Router();

function sendExcel(res: any, data: Record<string, unknown>[], sheetName: string, filename: string) {
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.send(buf);
}

router.get("/stock", requireAuth, async (req, res): Promise<void> => {
  const rows = await db.select().from(productsTable).orderBy(productsTable.id);
  const isAdmin = req.session!.role === "admin";
  sendExcel(res, rows.map(p => ({
    "ID Produit": p.productId,
    "IMEI": p.imei ?? "",
    "Produit": p.product,
    "Marque": p.brand,
    "Capacité": p.capacity ?? "",
    "Couleur": p.color ?? "",
    "Fournisseur": p.supplier ?? "",
    ...(isAdmin ? { "Prix d'achat (FCFA)": p.purchasePrice !== null ? Number(p.purchasePrice) : "" } : {}),
    "Prix de vente (FCFA)": p.sellingPrice !== null ? Number(p.sellingPrice) : "",
    ...(isAdmin && p.purchasePrice !== null && p.sellingPrice !== null
      ? { "Bénéfice (FCFA)": Number(p.sellingPrice) - Number(p.purchasePrice) }
      : {}),
    "Statut": p.status === "en_stock" ? "En Stock" : p.status === "chez_partenaire" ? "Chez Partenaire" : "Vendu",
    "Date d'entrée": p.entryDate,
    "Date de vente": p.saleDate ?? "",
  })), "Stock", "stock_homies_erp.xlsx");
});

router.get("/sales", requireAuth, async (req, res): Promise<void> => {
  const rows = await db.select().from(salesTable)
    .leftJoin(productsTable, eq(salesTable.productId, productsTable.id))
    .leftJoin(usersTable, eq(salesTable.sellerId, usersTable.id))
    .orderBy(salesTable.saleDate);

  sendExcel(res, rows.map(r => ({
    "Date": r.sales.saleDate,
    "Heure": r.sales.saleTime,
    "Client": r.sales.clientName ?? "",
    "Téléphone": r.sales.clientPhone ?? "",
    "Produit": r.products?.product ?? "",
    "IMEI": r.products?.imei ?? "",
    "ID Produit": r.products?.productId ?? "",
    "Vendeur": r.users?.fullName ?? "",
    "Mode de paiement": r.sales.paymentMode,
    "Type": r.sales.saleType === "normal" ? "Vente normale" : "Troc",
    "Montant (FCFA)": Number(r.sales.amount),
    "Annulé": r.sales.cancelled ? "Oui" : "Non",
  })), "Ventes", "ventes_homies_erp.xlsx");
});

router.get("/expenses", requireAuth, async (req, res): Promise<void> => {
  const rows = await db.select().from(expensesTable)
    .leftJoin(usersTable, eq(expensesTable.userId, usersTable.id))
    .orderBy(expensesTable.expenseDate);
  sendExcel(res, rows.map(r => ({
    "Date": r.expenses.expenseDate,
    "Heure": r.expenses.expenseTime,
    "Libellé": r.expenses.label,
    "Montant (FCFA)": Number(r.expenses.amount),
    "Utilisateur": r.users?.fullName ?? "",
  })), "Dépenses", "depenses_homies_erp.xlsx");
});

router.get("/clients", requireAdmin, async (req, res): Promise<void> => {
  const clients = await db.select().from(clientsTable).orderBy(clientsTable.fullName);
  const salesData = await db.select({
    clientId: salesTable.clientId,
    count: sql<number>`count(*)::int`,
    total: sql<number>`sum(${salesTable.amount}::numeric)`,
    lastDate: sql<string>`max(${salesTable.saleDate})`,
  }).from(salesTable).where(sql`${salesTable.clientId} is not null AND ${salesTable.cancelled} = false`).groupBy(salesTable.clientId);
  const salesMap = new Map(salesData.map(s => [s.clientId, s]));
  sendExcel(res, clients.map(c => {
    const s = salesMap.get(c.id);
    return {
      "Nom complet": c.fullName,
      "Téléphone": c.phone ?? "",
      "Date de création": new Date(c.createdAt).toLocaleDateString("fr-FR"),
      "Nb achats": s?.count ?? 0,
      "Total achats (FCFA)": s ? Number(s.total) : 0,
      "Dernière date d'achat": s?.lastDate ?? "",
    };
  }), "Clients", "clients_homies_erp.xlsx");
});

router.get("/movements", requireAuth, async (req, res): Promise<void> => {
  const rows = await db.select().from(movementsTable)
    .leftJoin(usersTable, eq(movementsTable.userId, usersTable.id))
    .orderBy(movementsTable.movementDate);
  const typeLabels: Record<string, string> = {
    achat: "Achat", vente: "Vente", entree_troc: "Entrée Troc", depense: "Dépense",
    sortie_partenaire: "Sortie Partenaire", retour_partenaire: "Retour Partenaire",
    modification_produit: "Modification Produit", suppression_produit: "Suppression Produit", annulation: "Annulation",
  };
  sendExcel(res, rows.map(r => ({
    "Date": r.movements.movementDate,
    "Heure": r.movements.movementTime,
    "Type": typeLabels[r.movements.movementType] ?? r.movements.movementType,
    "Utilisateur": r.users?.fullName ?? "",
    "Réf. Produit": r.movements.productRef ?? "",
    "IMEI": r.movements.imei ?? "",
    "Description": r.movements.description,
  })), "Mouvements", "mouvements_homies_erp.xlsx");
});

export default router;
