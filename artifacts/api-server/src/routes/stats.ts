import { Router } from "express";
import { db, productsTable, salesTable, expensesTable, clientsTable } from "@workspace/db";
import { eq, sql, and, gte, lte } from "drizzle-orm";
import { requireAuth, requireAdmin } from "../middlewares/auth";

const router = Router();

function todayStr() { return new Date().toISOString().split("T")[0]; }

function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split("T")[0];
}

function monthStart() {
  const d = new Date();
  d.setDate(1);
  return d.toISOString().split("T")[0];
}

function weekStart() {
  const d = new Date();
  d.setDate(d.getDate() - 6);
  return d.toISOString().split("T")[0];
}

router.get("/dashboard", requireAuth, async (req, res): Promise<void> => {
  const today = todayStr();
  const isAdmin = req.session!.role === "admin";

  const [stockCounts] = await db.select({
    en_stock: sql<number>`count(*) filter (where ${productsTable.status} = 'en_stock')::int`,
    chez_partenaire: sql<number>`count(*) filter (where ${productsTable.status} = 'chez_partenaire')::int`,
    vendu: sql<number>`count(*) filter (where ${productsTable.status} = 'vendu')::int`,
  }).from(productsTable);

  const todaySales = await db.select().from(salesTable).where(
    and(eq(salesTable.saleDate, today), eq(salesTable.cancelled, false))
  );

  const todayExpenses = await db.select({ total: sql<number>`coalesce(sum(${expensesTable.amount}::numeric), 0)` })
    .from(expensesTable).where(eq(expensesTable.expenseDate, today));

  const revenuToday = todaySales.reduce((sum, s) => sum + Number(s.amount), 0);
  const expensesToday = Number(todayExpenses[0]?.total ?? 0);

  const lowStock = await db.select().from(productsTable).where(eq(productsTable.status, "en_stock")).limit(5);

  const result: Record<string, unknown> = {
    productsInStock: stockCounts.en_stock ?? 0,
    productsAtPartner: stockCounts.chez_partenaire ?? 0,
    productsSold: stockCounts.vendu ?? 0,
    salesToday: todaySales.length,
    expensesToday,
    revenuToday,
    cashBalanceToday: revenuToday - expensesToday,
    lowStockProducts: lowStock.map(p => ({ ...p, purchasePrice: undefined, sellingPrice: p.sellingPrice !== null ? Number(p.sellingPrice) : null })),
  };

  if (isAdmin) {
    const [totalClients] = await db.select({ count: sql<number>`count(*)::int` }).from(clientsTable);
    const [newToday] = await db.select({ count: sql<number>`count(*)::int` }).from(clientsTable)
      .where(sql`date(${clientsTable.createdAt}) = ${today}::date`);

    const monthSales = await db.select({ amount: salesTable.amount, productId: salesTable.productId }).from(salesTable).where(
      and(gte(salesTable.saleDate, monthStart()), eq(salesTable.cancelled, false))
    );
    const monthProducts = await db.select({ id: productsTable.id, purchasePrice: productsTable.purchasePrice, sellingPrice: productsTable.sellingPrice })
      .from(productsTable);
    const productMap = new Map(monthProducts.map(p => [p.id, p]));

    let profitToday = 0;
    let profitMonth = 0;
    for (const s of todaySales) {
      const prod = productMap.get(s.productId);
      if (prod?.purchasePrice && prod?.sellingPrice) profitToday += Number(prod.sellingPrice) - Number(prod.purchasePrice);
    }
    for (const s of monthSales) {
      const prod = productMap.get(s.productId);
      if (prod?.purchasePrice && prod?.sellingPrice) profitMonth += Number(prod.sellingPrice) - Number(prod.purchasePrice);
    }

    result.totalClients = totalClients.count ?? 0;
    result.newClientsToday = newToday.count ?? 0;
    result.profitToday = profitToday;
    result.profitMonth = profitMonth;
  }

  res.json(result);
});

router.get("/financial", requireAdmin, async (req, res): Promise<void> => {
  const period = (req.query.period as string) || "month";
  const startDate = period === "day" ? todayStr() : period === "week" ? weekStart() : monthStart();
  const endDate = todayStr();

  const sales = await db.select({ amount: salesTable.amount, saleDate: salesTable.saleDate, productId: salesTable.productId })
    .from(salesTable).where(and(gte(salesTable.saleDate, startDate), lte(salesTable.saleDate, endDate), eq(salesTable.cancelled, false)));
  const expenses = await db.select({ amount: expensesTable.amount, expenseDate: expensesTable.expenseDate })
    .from(expensesTable).where(and(gte(expensesTable.expenseDate, startDate), lte(expensesTable.expenseDate, endDate)));
  const products = await db.select({ id: productsTable.id, purchasePrice: productsTable.purchasePrice, sellingPrice: productsTable.sellingPrice }).from(productsTable);
  const productMap = new Map(products.map(p => [p.id, p]));

  const byDay: Map<string, { revenue: number; expenses: number; profit: number }> = new Map();

  for (const s of sales) {
    const d = byDay.get(s.saleDate) ?? { revenue: 0, expenses: 0, profit: 0 };
    d.revenue += Number(s.amount);
    const prod = productMap.get(s.productId);
    if (prod?.purchasePrice && prod?.sellingPrice) d.profit += Number(prod.sellingPrice) - Number(prod.purchasePrice);
    byDay.set(s.saleDate, d);
  }
  for (const e of expenses) {
    const d = byDay.get(e.expenseDate) ?? { revenue: 0, expenses: 0, profit: 0 };
    d.expenses += Number(e.amount);
    byDay.set(e.expenseDate, d);
  }

  const revenueByDay = Array.from(byDay.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([date, v]) => ({ date, ...v }));
  const totalRevenue = sales.reduce((s, x) => s + Number(x.amount), 0);
  const totalExpenses = expenses.reduce((s, x) => s + Number(x.amount), 0);
  let totalProfit = 0;
  for (const s of sales) {
    const prod = productMap.get(s.productId);
    if (prod?.purchasePrice && prod?.sellingPrice) totalProfit += Number(prod.sellingPrice) - Number(prod.purchasePrice);
  }

  res.json({ period, revenue: totalRevenue, expenses: totalExpenses, profit: totalProfit, revenueByDay });
});

router.get("/top-products", requireAdmin, async (req, res): Promise<void> => {
  const limit = parseInt((req.query.limit as string) || "10");
  const rows = await db.select({
    product: productsTable.product,
    brand: productsTable.brand,
    count: sql<number>`count(*)::int`,
    revenue: sql<number>`sum(${salesTable.amount}::numeric)`,
  }).from(salesTable)
    .leftJoin(productsTable, eq(salesTable.productId, productsTable.id))
    .where(eq(salesTable.cancelled, false))
    .groupBy(productsTable.product, productsTable.brand)
    .orderBy(sql`count(*) desc`)
    .limit(limit);

  res.json(rows.map(r => ({ product: r.product ?? "", brand: r.brand ?? "", count: r.count, revenue: Number(r.revenue ?? 0) })));
});

router.get("/payment-breakdown", requireAdmin, async (req, res): Promise<void> => {
  const period = (req.query.period as string) || "month";
  const startDate = period === "day" ? todayStr() : period === "week" ? weekStart() : monthStart();

  const rows = await db.select({
    paymentMode: salesTable.paymentMode,
    total: sql<number>`sum(${salesTable.amount}::numeric)`,
  }).from(salesTable)
    .where(and(gte(salesTable.saleDate, startDate), eq(salesTable.cancelled, false)))
    .groupBy(salesTable.paymentMode);

  const breakdown = { om: 0, momo: 0, cash: 0, total: 0, period };
  for (const r of rows) {
    const val = Number(r.total ?? 0);
    if (r.paymentMode === "OM") breakdown.om = val;
    else if (r.paymentMode === "MOMO") breakdown.momo = val;
    else if (r.paymentMode === "Cash") breakdown.cash = val;
    breakdown.total += val;
  }
  res.json(breakdown);
});

router.get("/top-sellers", requireAdmin, async (req, res): Promise<void> => {
  const limit = parseInt((req.query.limit as string) || "3");

  const rows = await db.select({
    vendorName: salesTable.vendorName,
    salesCount: sql<number>`count(*)::int`,
    revenue: sql<number>`sum(${salesTable.amount}::numeric)`,
  }).from(salesTable)
    .where(and(eq(salesTable.cancelled, false), sql`${salesTable.vendorName} is not null`))
    .groupBy(salesTable.vendorName)
    .orderBy(sql`count(*) desc`)
    .limit(limit);

  res.json(rows.map(r => ({
    vendorName: r.vendorName ?? "",
    salesCount: r.salesCount,
    revenue: Number(r.revenue ?? 0),
  })));
});

export default router;
