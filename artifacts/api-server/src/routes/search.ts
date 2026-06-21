import { Router } from "express";
import { db, productsTable, salesTable, clientsTable, partnersTable } from "@workspace/db";
import { ilike, or, eq } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";

const router = Router();

router.get("/", requireAuth, async (req, res): Promise<void> => {
  const { q } = req.query as Record<string, string>;
  if (!q || q.trim().length < 2) {
    res.json({ products: [], sales: [], clients: [], partners: [] });
    return;
  }

  const term = `%${q.trim()}%`;

  const [products, clients, partners] = await Promise.all([
    db.select({
      id: productsTable.id,
      productId: productsTable.productId,
      product: productsTable.product,
      brand: productsTable.brand,
      imei: productsTable.imei,
      status: productsTable.status,
      sellingPrice: productsTable.sellingPrice,
    }).from(productsTable).where(
      or(
        ilike(productsTable.imei, term),
        ilike(productsTable.product, term),
        ilike(productsTable.brand, term),
        ilike(productsTable.productId, term),
        ilike(productsTable.supplier, term),
      )
    ).limit(10),

    db.select({
      id: clientsTable.id,
      fullName: clientsTable.fullName,
      phone: clientsTable.phone,
    }).from(clientsTable).where(
      or(
        ilike(clientsTable.fullName, term),
        ilike(clientsTable.phone, term),
      )
    ).limit(10),

    db.select({
      id: partnersTable.id,
      name: partnersTable.name,
      phone: partnersTable.phone,
    }).from(partnersTable).where(
      or(
        ilike(partnersTable.name, term),
        ilike(partnersTable.phone, term),
      )
    ).limit(10),
  ]);

  const salesRows = await db.select().from(salesTable)
    .leftJoin(productsTable, eq(salesTable.productId, productsTable.id))
    .where(
      or(
        ilike(salesTable.clientName, term),
        ilike(salesTable.clientPhone, term),
        ilike(salesTable.vendorName, term),
        ilike(productsTable.imei, term),
        ilike(productsTable.product, term),
      )
    ).limit(10);

  res.json({
    products: products.map(p => ({ ...p, sellingPrice: p.sellingPrice !== null ? Number(p.sellingPrice) : null })),
    sales: salesRows.map(r => ({ ...r.sales, amount: Number(r.sales.amount), productName: r.products?.product })),
    clients,
    partners,
  });
});

export default router;
