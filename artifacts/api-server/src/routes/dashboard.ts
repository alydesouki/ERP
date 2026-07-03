import { Router, type IRouter } from "express";
import { requireAuth, requirePermission } from "../middleware/auth";
import { AnalyticsService } from "../lib/analytics-service";

const router: IRouter = Router();

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

    const salesAgg = await AnalyticsService.getSalesKPIs(storeId, today);
    const purchAgg = await AnalyticsService.getPurchasesKPIs(storeId, today);
    const expAgg = await AnalyticsService.getExpensesKPIs(storeId, today);
    const treasuryBalance = await AnalyticsService.getTreasuryBalance(storeId);
    const customerDebts = await AnalyticsService.getCustomerDebts(storeId);
    const supplierDebts = await AnalyticsService.getSupplierDebts(storeId);

    // For low stock count, we can just use the db here since it's simple, or add it to AnalyticsService.
    // Given we want to keep it simple, I'll add it to AnalyticsService too or do it here.
    // Actually, AnalyticsService doesn't have low stock. Let's add a quick db query.
    const { db, inventoryItemsTable, productsTable, productVariantsTable } = require("@workspace/db");
    const { and, eq, gt, sql } = require("drizzle-orm");
    const lowStockRows = await db
      .select({ variantId: inventoryItemsTable.variantId })
      .from(inventoryItemsTable)
      .innerJoin(productVariantsTable, eq(productVariantsTable.id, inventoryItemsTable.variantId))
      .innerJoin(productsTable, eq(productsTable.id, productVariantsTable.productId))
      .where(and(eq(inventoryItemsTable.storeId, storeId), gt(productsTable.reorderPoint, 0)))
      .groupBy(inventoryItemsTable.variantId, productsTable.reorderPoint)
      .having(sql`sum(${inventoryItemsTable.quantity}) <= ${productsTable.reorderPoint}`);

    res.json({
      todaySales: salesAgg.revenue,
      todayProfit: salesAgg.revenue - salesAgg.cost,
      todayPurchases: purchAgg.total,
      todayExpenses: expAgg.total,
      treasuryBalance: treasuryBalance,
      lowStockCount: lowStockRows.length,
      customerDebts: customerDebts,
      supplierDebts: supplierDebts,
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

    const dailySales = await AnalyticsService.getDailySales(storeId, last30);
    const monthlyRevenue = await AnalyticsService.getMonthlyRevenue(storeId, last12mo);
    const cashFlow = await AnalyticsService.getCashFlow(storeId, last30);
    const bestSellingProducts = await AnalyticsService.getBestSellingProducts(storeId);
    const salesByPaymentMethod = await AnalyticsService.getSalesByPaymentMethod(storeId);
    const salesByCategory = await AnalyticsService.getSalesByCategory(storeId);

    res.json({
      dailySales,
      monthlyRevenue,
      cashFlow,
      bestSellingProducts,
      salesByPaymentMethod,
      salesByCategory,
    });
  },
);

export default router;
