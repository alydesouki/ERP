import { Router, type IRouter } from "express";
import { and, desc, eq, gte, lte, sql, type SQL } from "drizzle-orm";
import {
  db,
  invoicesTable,
  invoiceItemsTable,
  invoicePaymentsTable,
  salesReturnsTable,
  purchaseInvoicesTable,
  expensesTable,
  expenseCategoriesTable,
  salaryRecordsTable,
  treasuryAccountsTable,
  treasuryTransactionsTable,
  customersTable,
  suppliersTable,
  inventoryItemsTable,
  warehousesTable,
  productsTable,
  productVariantsTable,
  categoriesTable,
  brandsTable,
  colorsTable,
  sizesTable,
} from "@workspace/db";
import {
  GetSalesSummaryReportQueryParams,
  GetPurchasesSummaryReportQueryParams,
  GetInventoryStockReportQueryParams,
  GetLowStockReportQueryParams,
  GetProfitLossReportQueryParams,
  GetTreasuryReportQueryParams,
  GetExpenseReportQueryParams,
  GetTopProductsReportQueryParams,
} from "@workspace/api-zod";
import { requireAuth, requirePermission } from "../middleware/auth";
import { toNum } from "../lib/money";

const router: IRouter = Router();

function dateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function endOfDay(d: Date): Date {
  const e = new Date(d);
  e.setHours(23, 59, 59, 999);
  return e;
}

const variantLabel = sql<
  string | null
>`nullif(trim(concat_ws(' / ', ${colorsTable.name}, ${sizesTable.name})), '')`;

// ── Sales summary ───────────────────────────────────────────────────────────

router.get(
  "/reports/sales-summary",
  requireAuth,
  requirePermission("reports.sales"),
  async (req, res) => {
    const storeId = req.auth!.storeId;
    const q = GetSalesSummaryReportQueryParams.parse(req.query);

    const conditions: SQL[] = [eq(invoicesTable.storeId, storeId)];
    if (q.fromDate) conditions.push(gte(invoicesTable.createdAt, q.fromDate));
    if (q.toDate) conditions.push(lte(invoicesTable.createdAt, endOfDay(q.toDate)));
    if (q.customerId) conditions.push(eq(invoicesTable.customerId, q.customerId));
    if (q.paymentMethod) conditions.push(eq(invoicePaymentsTable.method, q.paymentMethod));

    const rows = await db
      .select({
        id: invoicesTable.id,
        invoiceNumber: invoicesTable.invoiceNumber,
        date: invoicesTable.createdAt,
        customerName: customersTable.name,
        total: invoicesTable.totalAmount,
        paymentMethod: sql<
          string | null
        >`string_agg(distinct ${invoicePaymentsTable.method}::text, ', ')`,
        paymentStatus: invoicesTable.paymentStatus,
      })
      .from(invoicesTable)
      .leftJoin(invoicePaymentsTable, eq(invoicePaymentsTable.invoiceId, invoicesTable.id))
      .leftJoin(customersTable, eq(customersTable.id, invoicesTable.customerId))
      .where(and(...conditions))
      .groupBy(
        invoicesTable.id,
        invoicesTable.invoiceNumber,
        invoicesTable.createdAt,
        customersTable.name,
        invoicesTable.totalAmount,
        invoicesTable.paymentStatus,
      )
      .orderBy(desc(invoicesTable.createdAt));

    const total = rows.reduce((s, r) => s + toNum(r.total), 0);
    res.json({ rows, count: rows.length, total });
  },
);

// ── Purchases summary ───────────────────────────────────────────────────────

router.get(
  "/reports/purchases-summary",
  requireAuth,
  requirePermission("reports.view"),
  async (req, res) => {
    const storeId = req.auth!.storeId;
    const q = GetPurchasesSummaryReportQueryParams.parse(req.query);

    const conditions: SQL[] = [eq(purchaseInvoicesTable.storeId, storeId)];
    if (q.fromDate) conditions.push(gte(purchaseInvoicesTable.invoiceDate, dateStr(q.fromDate)));
    if (q.toDate) conditions.push(lte(purchaseInvoicesTable.invoiceDate, dateStr(q.toDate)));
    if (q.supplierId) conditions.push(eq(purchaseInvoicesTable.supplierId, q.supplierId));

    const rows = await db
      .select({
        id: purchaseInvoicesTable.id,
        invoiceNumber: purchaseInvoicesTable.invoiceNumber,
        date: purchaseInvoicesTable.invoiceDate,
        supplierName: suppliersTable.name,
        total: purchaseInvoicesTable.totalAmount,
        status: purchaseInvoicesTable.status,
      })
      .from(purchaseInvoicesTable)
      .leftJoin(suppliersTable, eq(suppliersTable.id, purchaseInvoicesTable.supplierId))
      .where(and(...conditions))
      .orderBy(desc(purchaseInvoicesTable.invoiceDate));

    const total = rows.reduce((s, r) => s + toNum(r.total), 0);
    res.json({ rows, count: rows.length, total });
  },
);

// ── Inventory stock valuation ───────────────────────────────────────────────

router.get(
  "/reports/inventory-stock",
  requireAuth,
  requirePermission("reports.inventory"),
  async (req, res) => {
    const storeId = req.auth!.storeId;
    const q = GetInventoryStockReportQueryParams.parse(req.query);

    const conditions: SQL[] = [eq(inventoryItemsTable.storeId, storeId)];
    if (q.warehouseId) conditions.push(eq(inventoryItemsTable.warehouseId, q.warehouseId));
    if (q.categoryId) conditions.push(eq(productsTable.categoryId, q.categoryId));
    if (q.brandId) conditions.push(eq(productsTable.brandId, q.brandId));

    const rows = await db
      .select({
        variantId: inventoryItemsTable.variantId,
        productName: productsTable.name,
        sku: productVariantsTable.sku,
        variantLabel,
        warehouseName: warehousesTable.name,
        categoryName: categoriesTable.name,
        brandName: brandsTable.name,
        quantity: inventoryItemsTable.quantity,
        reorderPoint: productsTable.reorderPoint,
        cost: productVariantsTable.costPrice,
        value: sql<number>`(${inventoryItemsTable.quantity} * ${productVariantsTable.costPrice})::float8`,
      })
      .from(inventoryItemsTable)
      .innerJoin(productVariantsTable, eq(productVariantsTable.id, inventoryItemsTable.variantId))
      .innerJoin(productsTable, eq(productsTable.id, productVariantsTable.productId))
      .leftJoin(warehousesTable, eq(warehousesTable.id, inventoryItemsTable.warehouseId))
      .leftJoin(categoriesTable, eq(categoriesTable.id, productsTable.categoryId))
      .leftJoin(brandsTable, eq(brandsTable.id, productsTable.brandId))
      .leftJoin(colorsTable, eq(colorsTable.id, productVariantsTable.colorId))
      .leftJoin(sizesTable, eq(sizesTable.id, productVariantsTable.sizeId))
      .where(and(...conditions))
      .orderBy(productsTable.name);

    const totalValue = rows.reduce((s, r) => s + Number(r.value ?? 0), 0);
    const totalQuantity = rows.reduce((s, r) => s + (r.quantity ?? 0), 0);
    res.json({ rows, totalValue, totalQuantity });
  },
);

// ── Low stock ───────────────────────────────────────────────────────────────

router.get(
  "/reports/low-stock",
  requireAuth,
  requirePermission("reports.inventory"),
  async (req, res) => {
    const storeId = req.auth!.storeId;
    const q = GetLowStockReportQueryParams.parse(req.query);

    const conditions: SQL[] = [eq(inventoryItemsTable.storeId, storeId)];
    if (q.warehouseId) conditions.push(eq(inventoryItemsTable.warehouseId, q.warehouseId));

    const rows = await db
      .select({
        variantId: inventoryItemsTable.variantId,
        productName: productsTable.name,
        sku: productVariantsTable.sku,
        variantLabel,
        warehouseName: warehousesTable.name,
        quantity: inventoryItemsTable.quantity,
        reorderPoint: productsTable.reorderPoint,
        shortage: sql<number>`(${productsTable.reorderPoint} - ${inventoryItemsTable.quantity})`,
      })
      .from(inventoryItemsTable)
      .innerJoin(productVariantsTable, eq(productVariantsTable.id, inventoryItemsTable.variantId))
      .innerJoin(productsTable, eq(productsTable.id, productVariantsTable.productId))
      .leftJoin(warehousesTable, eq(warehousesTable.id, inventoryItemsTable.warehouseId))
      .leftJoin(colorsTable, eq(colorsTable.id, productVariantsTable.colorId))
      .leftJoin(sizesTable, eq(sizesTable.id, productVariantsTable.sizeId))
      .where(
        and(
          ...conditions,
          sql`${productsTable.reorderPoint} > 0`,
          sql`${inventoryItemsTable.quantity} <= ${productsTable.reorderPoint}`,
        ),
      )
      .orderBy(desc(sql`(${productsTable.reorderPoint} - ${inventoryItemsTable.quantity})`));

    res.json({ rows, count: rows.length });
  },
);

// ── Profit & loss ───────────────────────────────────────────────────────────

router.get(
  "/reports/profit-loss",
  requireAuth,
  requirePermission("reports.view"),
  async (req, res) => {
    const storeId = req.auth!.storeId;
    const q = GetProfitLossReportQueryParams.parse(req.query);

    const salesConds: SQL[] = [eq(invoicesTable.storeId, storeId)];
    if (q.fromDate) salesConds.push(gte(invoicesTable.createdAt, q.fromDate));
    if (q.toDate) salesConds.push(lte(invoicesTable.createdAt, endOfDay(q.toDate)));

    const [salesAgg] = await db
      .select({
        revenue: sql<number>`coalesce(sum(${invoicesTable.totalAmount}),0)::float8`,
        cogs: sql<number>`coalesce(sum(${invoicesTable.totalCost}),0)::float8`,
      })
      .from(invoicesTable)
      .where(and(...salesConds));

    const returnConds: SQL[] = [eq(salesReturnsTable.storeId, storeId)];
    if (q.fromDate) returnConds.push(gte(salesReturnsTable.createdAt, q.fromDate));
    if (q.toDate) returnConds.push(lte(salesReturnsTable.createdAt, endOfDay(q.toDate)));

    const [returnAgg] = await db
      .select({
        total: sql<number>`coalesce(sum(${salesReturnsTable.totalAmount}),0)::float8`,
        cost: sql<number>`coalesce(sum(${salesReturnsTable.totalCost}),0)::float8`,
      })
      .from(salesReturnsTable)
      .where(and(...returnConds));

    const expConds: SQL[] = [eq(expensesTable.storeId, storeId)];
    if (q.fromDate) expConds.push(gte(expensesTable.expenseDate, dateStr(q.fromDate)));
    if (q.toDate) expConds.push(lte(expensesTable.expenseDate, dateStr(q.toDate)));

    const [expAgg] = await db
      .select({ total: sql<number>`coalesce(sum(${expensesTable.amount}),0)::float8` })
      .from(expensesTable)
      .where(and(...expConds));

    const salaryConds: SQL[] = [
      eq(salaryRecordsTable.storeId, storeId),
      eq(salaryRecordsTable.status, "PAID"),
    ];
    if (q.fromDate) salaryConds.push(gte(salaryRecordsTable.paidAt, q.fromDate));
    if (q.toDate) salaryConds.push(lte(salaryRecordsTable.paidAt, endOfDay(q.toDate)));

    const [salaryAgg] = await db
      .select({ total: sql<number>`coalesce(sum(${salaryRecordsTable.netAmount}),0)::float8` })
      .from(salaryRecordsTable)
      .where(and(...salaryConds));

    const revenue = salesAgg?.revenue ?? 0;
    const salesReturns = returnAgg?.total ?? 0;
    const netRevenue = revenue - salesReturns;
    const cogs = (salesAgg?.cogs ?? 0) - (returnAgg?.cost ?? 0);
    const grossProfit = netRevenue - cogs;
    const expenses = expAgg?.total ?? 0;
    const salaries = salaryAgg?.total ?? 0;
    const netProfit = grossProfit - expenses - salaries;

    res.json({
      revenue,
      salesReturns,
      netRevenue,
      cogs,
      grossProfit,
      expenses,
      salaries,
      netProfit,
    });
  },
);

// ── Treasury movements ──────────────────────────────────────────────────────

router.get(
  "/reports/treasury",
  requireAuth,
  requirePermission("reports.view"),
  async (req, res) => {
    const storeId = req.auth!.storeId;
    const q = GetTreasuryReportQueryParams.parse(req.query);

    const conditions: SQL[] = [eq(treasuryTransactionsTable.storeId, storeId)];
    if (q.fromDate) conditions.push(gte(treasuryTransactionsTable.createdAt, q.fromDate));
    if (q.toDate) conditions.push(lte(treasuryTransactionsTable.createdAt, endOfDay(q.toDate)));
    if (q.accountId) conditions.push(eq(treasuryTransactionsTable.treasuryAccountId, q.accountId));

    const rows = await db
      .select({
        id: treasuryTransactionsTable.id,
        date: treasuryTransactionsTable.createdAt,
        accountName: treasuryAccountsTable.name,
        direction: treasuryTransactionsTable.direction,
        amount: treasuryTransactionsTable.amount,
        balanceAfter: treasuryTransactionsTable.balanceAfter,
        referenceType: treasuryTransactionsTable.referenceType,
      })
      .from(treasuryTransactionsTable)
      .leftJoin(
        treasuryAccountsTable,
        eq(treasuryAccountsTable.id, treasuryTransactionsTable.treasuryAccountId),
      )
      .where(and(...conditions))
      .orderBy(desc(treasuryTransactionsTable.createdAt));

    let totalIn = 0;
    let totalOut = 0;
    for (const r of rows) {
      if (r.direction === "IN") totalIn += toNum(r.amount);
      else totalOut += toNum(r.amount);
    }
    res.json({ rows, totalIn, totalOut });
  },
);

// ── Expenses ────────────────────────────────────────────────────────────────

router.get(
  "/reports/expenses",
  requireAuth,
  requirePermission("reports.view"),
  async (req, res) => {
    const storeId = req.auth!.storeId;
    const q = GetExpenseReportQueryParams.parse(req.query);

    const conditions: SQL[] = [eq(expensesTable.storeId, storeId)];
    if (q.fromDate) conditions.push(gte(expensesTable.expenseDate, dateStr(q.fromDate)));
    if (q.toDate) conditions.push(lte(expensesTable.expenseDate, dateStr(q.toDate)));
    if (q.categoryId) conditions.push(eq(expensesTable.categoryId, q.categoryId));

    const rows = await db
      .select({
        id: expensesTable.id,
        date: expensesTable.expenseDate,
        categoryName: expenseCategoriesTable.name,
        description: expensesTable.description,
        amount: expensesTable.amount,
      })
      .from(expensesTable)
      .leftJoin(expenseCategoriesTable, eq(expenseCategoriesTable.id, expensesTable.categoryId))
      .where(and(...conditions))
      .orderBy(desc(expensesTable.expenseDate));

    const total = rows.reduce((s, r) => s + toNum(r.amount), 0);
    res.json({ rows, total });
  },
);

// ── Top products ────────────────────────────────────────────────────────────

router.get(
  "/reports/top-products",
  requireAuth,
  requirePermission("reports.sales"),
  async (req, res) => {
    const storeId = req.auth!.storeId;
    const q = GetTopProductsReportQueryParams.parse(req.query);

    const conditions: SQL[] = [eq(invoicesTable.storeId, storeId)];
    if (q.fromDate) conditions.push(gte(invoicesTable.createdAt, q.fromDate));
    if (q.toDate) conditions.push(lte(invoicesTable.createdAt, endOfDay(q.toDate)));

    const rows = await db
      .select({
        variantId: invoiceItemsTable.variantId,
        productName: productsTable.name,
        sku: productVariantsTable.sku,
        quantitySold: sql<number>`coalesce(sum(${invoiceItemsTable.quantity}),0)::int`,
        revenue: sql<number>`coalesce(sum(${invoiceItemsTable.lineTotal}),0)::float8`,
      })
      .from(invoiceItemsTable)
      .innerJoin(invoicesTable, eq(invoicesTable.id, invoiceItemsTable.invoiceId))
      .innerJoin(productVariantsTable, eq(productVariantsTable.id, invoiceItemsTable.variantId))
      .innerJoin(productsTable, eq(productsTable.id, productVariantsTable.productId))
      .where(and(...conditions))
      .groupBy(invoiceItemsTable.variantId, productsTable.name, productVariantsTable.sku)
      .orderBy(desc(sql`sum(${invoiceItemsTable.quantity})`))
      .limit(50);

    res.json({ rows });
  },
);

export default router;
