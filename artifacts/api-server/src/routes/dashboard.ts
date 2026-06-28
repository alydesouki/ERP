import { Router, type IRouter } from "express";
import { and, desc, eq, gt, gte, sql } from "drizzle-orm";
import {
  db,
  invoicesTable,
  invoiceItemsTable,
  invoicePaymentsTable,
  purchaseInvoicesTable,
  expensesTable,
  treasuryAccountsTable,
  treasuryTransactionsTable,
  customersTable,
  suppliersTable,
  inventoryItemsTable,
  productsTable,
  productVariantsTable,
  categoriesTable,
} from "@workspace/db";
import { requireAuth, requirePermission } from "../middleware/auth";
import { toNum } from "../lib/money";

const router: IRouter = Router();

function dateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(0, 0, 0, 0);
  return d;
}

function startOfMonth(): Date {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
}

router.get(
  "/dashboard/kpis",
  requireAuth,
  requirePermission("dashboard.view"),
  async (req, res) => {
    const storeId = req.auth!.storeId;
    const today = startOfToday();
    const todayDateStr = dateStr(new Date());

    const [salesAgg] = await db
      .select({
        revenue: sql<number>`coalesce(sum(${invoicesTable.totalAmount}),0)::float8`,
        cost: sql<number>`coalesce(sum(${invoicesTable.totalCost}),0)::float8`,
      })
      .from(invoicesTable)
      .where(and(eq(invoicesTable.storeId, storeId), gte(invoicesTable.createdAt, today)));

    const [purchAgg] = await db
      .select({
        total: sql<number>`coalesce(sum(${purchaseInvoicesTable.totalAmount}),0)::float8`,
      })
      .from(purchaseInvoicesTable)
      .where(
        and(
          eq(purchaseInvoicesTable.storeId, storeId),
          gte(purchaseInvoicesTable.createdAt, today),
        ),
      );

    const [expAgg] = await db
      .select({
        total: sql<number>`coalesce(sum(${expensesTable.amount}),0)::float8`,
      })
      .from(expensesTable)
      .where(
        and(
          eq(expensesTable.storeId, storeId),
          eq(expensesTable.expenseDate, todayDateStr),
        ),
      );

    const [treasuryAgg] = await db
      .select({
        balance: sql<number>`coalesce(sum(${treasuryAccountsTable.balance}),0)::float8`,
      })
      .from(treasuryAccountsTable)
      .where(eq(treasuryAccountsTable.storeId, storeId));

    const [custAgg] = await db
      .select({
        total: sql<number>`coalesce(sum(case when ${customersTable.currentBalance} > 0 then ${customersTable.currentBalance} else 0 end),0)::float8`,
      })
      .from(customersTable)
      .where(eq(customersTable.storeId, storeId));

    const [suppAgg] = await db
      .select({
        total: sql<number>`coalesce(sum(case when ${suppliersTable.currentBalance} > 0 then ${suppliersTable.currentBalance} else 0 end),0)::float8`,
      })
      .from(suppliersTable)
      .where(eq(suppliersTable.storeId, storeId));

    const lowStockRows = await db
      .select({ variantId: inventoryItemsTable.variantId })
      .from(inventoryItemsTable)
      .innerJoin(
        productVariantsTable,
        eq(productVariantsTable.id, inventoryItemsTable.variantId),
      )
      .innerJoin(productsTable, eq(productsTable.id, productVariantsTable.productId))
      .where(and(eq(inventoryItemsTable.storeId, storeId), gt(productsTable.reorderPoint, 0)))
      .groupBy(inventoryItemsTable.variantId, productsTable.reorderPoint)
      .having(sql`sum(${inventoryItemsTable.quantity}) <= ${productsTable.reorderPoint}`);

    res.json({
      todaySales: salesAgg?.revenue ?? 0,
      todayProfit: (salesAgg?.revenue ?? 0) - (salesAgg?.cost ?? 0),
      todayPurchases: purchAgg?.total ?? 0,
      todayExpenses: expAgg?.total ?? 0,
      treasuryBalance: treasuryAgg?.balance ?? 0,
      lowStockCount: lowStockRows.length,
      customerDebts: custAgg?.total ?? 0,
      supplierDebts: suppAgg?.total ?? 0,
    });
  },
);

router.get(
  "/dashboard/charts",
  requireAuth,
  requirePermission("dashboard.view"),
  async (req, res) => {
    const storeId = req.auth!.storeId;
    const last30 = daysAgo(29);
    const last12mo = (() => {
      const d = new Date();
      d.setMonth(d.getMonth() - 11);
      d.setDate(1);
      d.setHours(0, 0, 0, 0);
      return d;
    })();
    const monthStart = startOfMonth();

    const dayExpr = sql<string>`to_char(${invoicesTable.createdAt}, 'YYYY-MM-DD')`;
    const dailySales = await db
      .select({
        label: dayExpr,
        value: sql<number>`coalesce(sum(${invoicesTable.totalAmount}),0)::float8`,
      })
      .from(invoicesTable)
      .where(and(eq(invoicesTable.storeId, storeId), gte(invoicesTable.createdAt, last30)))
      .groupBy(dayExpr)
      .orderBy(dayExpr);

    const monthExpr = sql<string>`to_char(${invoicesTable.createdAt}, 'YYYY-MM')`;
    const monthlyRevenue = await db
      .select({
        label: monthExpr,
        value: sql<number>`coalesce(sum(${invoicesTable.totalAmount}),0)::float8`,
      })
      .from(invoicesTable)
      .where(and(eq(invoicesTable.storeId, storeId), gte(invoicesTable.createdAt, last12mo)))
      .groupBy(monthExpr)
      .orderBy(monthExpr);

    const cfDayExpr = sql<string>`to_char(${treasuryTransactionsTable.createdAt}, 'YYYY-MM-DD')`;
    const cashFlow = await db
      .select({
        label: cfDayExpr,
        inflow: sql<number>`coalesce(sum(case when ${treasuryTransactionsTable.direction} = 'IN' then ${treasuryTransactionsTable.amount} else 0 end),0)::float8`,
        outflow: sql<number>`coalesce(sum(case when ${treasuryTransactionsTable.direction} = 'OUT' then ${treasuryTransactionsTable.amount} else 0 end),0)::float8`,
      })
      .from(treasuryTransactionsTable)
      .where(
        and(
          eq(treasuryTransactionsTable.storeId, storeId),
          gte(treasuryTransactionsTable.createdAt, last30),
        ),
      )
      .groupBy(cfDayExpr)
      .orderBy(cfDayExpr);

    const bestSellingProducts = await db
      .select({
        label: productsTable.name,
        value: sql<number>`coalesce(sum(${invoiceItemsTable.quantity}),0)::float8`,
      })
      .from(invoiceItemsTable)
      .innerJoin(invoicesTable, eq(invoicesTable.id, invoiceItemsTable.invoiceId))
      .innerJoin(
        productVariantsTable,
        eq(productVariantsTable.id, invoiceItemsTable.variantId),
      )
      .innerJoin(productsTable, eq(productsTable.id, productVariantsTable.productId))
      .where(and(eq(invoicesTable.storeId, storeId), gte(invoicesTable.createdAt, last30)))
      .groupBy(productsTable.name)
      .orderBy(desc(sql`sum(${invoiceItemsTable.quantity})`))
      .limit(8);

    const salesByPaymentMethod = await db
      .select({
        label: sql<string>`${invoicePaymentsTable.method}::text`,
        value: sql<number>`coalesce(sum(${invoicePaymentsTable.amount}),0)::float8`,
      })
      .from(invoicePaymentsTable)
      .innerJoin(invoicesTable, eq(invoicesTable.id, invoicePaymentsTable.invoiceId))
      .where(and(eq(invoicesTable.storeId, storeId), gte(invoicesTable.createdAt, monthStart)))
      .groupBy(invoicePaymentsTable.method);

    const categoryPerformance = await db
      .select({
        label: categoriesTable.name,
        value: sql<number>`coalesce(sum(${invoiceItemsTable.lineTotal}),0)::float8`,
      })
      .from(invoiceItemsTable)
      .innerJoin(invoicesTable, eq(invoicesTable.id, invoiceItemsTable.invoiceId))
      .innerJoin(
        productVariantsTable,
        eq(productVariantsTable.id, invoiceItemsTable.variantId),
      )
      .innerJoin(productsTable, eq(productsTable.id, productVariantsTable.productId))
      .innerJoin(categoriesTable, eq(categoriesTable.id, productsTable.categoryId))
      .where(and(eq(invoicesTable.storeId, storeId), gte(invoicesTable.createdAt, monthStart)))
      .groupBy(categoriesTable.name);

    res.json({
      dailySales,
      monthlyRevenue,
      cashFlow,
      bestSellingProducts,
      salesByPaymentMethod,
      categoryPerformance,
    });
  },
);

export default router;
