import { Router, type IRouter } from "express";
import { and, asc, desc, eq, gte, lte, sql, type SQL } from "drizzle-orm";
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
  employeesTable,
  accountingAccountsTable,
  accountingTransactionsTable,
  accountingTransactionLinesTable,
  customerTransactionsTable,
  supplierTransactionsTable,
  inventoryMovementsTable,
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
function endOfDay(d: Date): Date {
  const e = new Date(d);
  e.setHours(23, 59, 59, 999);
  return e;
}
import { AnalyticsService } from "../lib/analytics-service";

const router: IRouter = Router();

function dateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

const variantLabel = sql<
  string | null
>`nullif(trim(coalesce(${colorsTable.name}, '') || ' / ' || coalesce(${sizesTable.name}, ''), ' / '), '')`;

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
        >`group_concat(distinct ${invoicePaymentsTable.method})`,
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
        value: sql<number>`CAST(${inventoryItemsTable.quantity} * CAST(${productVariantsTable.costPrice} AS REAL) AS REAL)`,
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

    const salesAgg = await AnalyticsService.getSalesKPIs(storeId, q.fromDate, q.toDate);
    const returnAgg = await AnalyticsService.getSalesReturnsKPIs(storeId, q.fromDate, q.toDate);
    const expAgg = await AnalyticsService.getExpensesKPIs(storeId, q.fromDate, q.toDate);
    const salaryAgg = await AnalyticsService.getSalariesKPIs(storeId, q.fromDate, q.toDate);

    const revenue = salesAgg.revenue ?? 0;
    const salesReturns = returnAgg.total ?? 0;
    const netRevenue = revenue - salesReturns;
    const cogs = (salesAgg.cost ?? 0) - (returnAgg.cost ?? 0);
    const grossProfit = netRevenue - cogs;
    const expenses = expAgg.total ?? 0;
    const salaries = salaryAgg.total ?? 0;
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
        quantitySold: sql<number>`CAST(coalesce(sum(${invoiceItemsTable.quantity}),0) AS INTEGER)`,
        revenue: sql<number>`CAST(coalesce(sum(${invoiceItemsTable.lineTotal}), 0) AS REAL)`,
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

// ── Account Statement ────────────────────────────────────────────────────────
// Returns all journal lines for a given accounting account, with running balance.

router.get(
  "/reports/account-statement",
  requireAuth,
  requirePermission("reports.view"),
  async (req, res) => {
    const storeId = req.auth!.storeId;
    const accountId = String(req.query["accountId"] ?? "");
    const fromDateStr = String(req.query["fromDate"] ?? "");
    const toDateStr = String(req.query["toDate"] ?? "");

    if (!accountId) {
      res.status(400).json({ error: "معرّف الحساب مطلوب" });
      return;
    }

    // Verify account belongs to this store
    const [account] = await db
      .select({
        id: accountingAccountsTable.id,
        code: accountingAccountsTable.code,
        name: accountingAccountsTable.name,
        type: accountingAccountsTable.type,
        normalBalance: accountingAccountsTable.normalBalance,
      })
      .from(accountingAccountsTable)
      .where(
        and(
          eq(accountingAccountsTable.id, accountId),
          eq(accountingAccountsTable.storeId, storeId),
        ),
      )
      .limit(1);

    if (!account) {
      res.status(404).json({ error: "الحساب غير موجود" });
      return;
    }

    const conditions: SQL[] = [
      eq(accountingTransactionLinesTable.accountId, accountId),
      eq(accountingTransactionLinesTable.storeId, storeId),
    ];

    // Date conditions applied on the parent transaction's entryDate
    const txConditions: SQL[] = [eq(accountingTransactionsTable.storeId, storeId)];
    if (fromDateStr) {
      const from = new Date(fromDateStr);
      if (!isNaN(from.getTime())) txConditions.push(gte(accountingTransactionsTable.entryDate, from));
    }
    if (toDateStr) {
      const to = new Date(toDateStr);
      if (!isNaN(to.getTime())) { to.setHours(23, 59, 59, 999); txConditions.push(lte(accountingTransactionsTable.entryDate, to)); }
    }

    const rows = await db
      .select({
        id: accountingTransactionLinesTable.id,
        entryDate: accountingTransactionsTable.entryDate,
        referenceType: accountingTransactionsTable.referenceType,
        referenceId: accountingTransactionsTable.referenceId,
        description: accountingTransactionsTable.description,
        debit: accountingTransactionLinesTable.debit,
        credit: accountingTransactionLinesTable.credit,
      })
      .from(accountingTransactionLinesTable)
      .innerJoin(
        accountingTransactionsTable,
        eq(accountingTransactionsTable.id, accountingTransactionLinesTable.transactionId),
      )
      .where(and(...conditions, ...txConditions))
      .orderBy(asc(accountingTransactionsTable.entryDate), asc(accountingTransactionLinesTable.id));

    // Compute running balance
    let runningBalance = 0;
    let totalDebit = 0;
    let totalCredit = 0;
    const isDebitNormal = account.normalBalance === "DEBIT";

    const rowsWithBalance = rows.map((r) => {
      const debit = toNum(r.debit);
      const credit = toNum(r.credit);
      totalDebit += debit;
      totalCredit += credit;
      // For debit-normal accounts: balance increases with debit, decreases with credit
      // For credit-normal accounts: balance increases with credit, decreases with debit
      if (isDebitNormal) {
        runningBalance += debit - credit;
      } else {
        runningBalance += credit - debit;
      }
      return {
        ...r,
        entryDate: r.entryDate instanceof Date ? r.entryDate.toISOString() : r.entryDate,
        runningBalance,
      };
    });

    res.json({
      account,
      rows: rowsWithBalance,
      totalDebit,
      totalCredit,
      currentBalance: runningBalance,
      count: rowsWithBalance.length,
    });
  },
);

// ── Accounting accounts list ──────────────────────────────────────────────────
// Helper endpoint to list all accounts for the store (used by the dropdown).

router.get(
  "/reports/accounting-accounts",
  requireAuth,
  requirePermission("reports.view"),
  async (req, res) => {
    const storeId = req.auth!.storeId;
    const rows = await db
      .select({
        id: accountingAccountsTable.id,
        code: accountingAccountsTable.code,
        name: accountingAccountsTable.name,
        type: accountingAccountsTable.type,
        normalBalance: accountingAccountsTable.normalBalance,
      })
      .from(accountingAccountsTable)
      .where(eq(accountingAccountsTable.storeId, storeId))
      .orderBy(asc(accountingAccountsTable.code));
    res.json({ rows });
  },
);

// ── Product Inquiry ──────────────────────────────────────────────────────────
// Complete product details + inventory movement history + stock across warehouses.

router.get(
  "/reports/product-inquiry",
  requireAuth,
  requirePermission("reports.inventory"),
  async (req, res) => {
    const storeId = req.auth!.storeId;
    const variantId = String(req.query["variantId"] ?? "");
    const fromDateStr = String(req.query["fromDate"] ?? "");
    const toDateStr = String(req.query["toDate"] ?? "");

    if (!variantId) {
      res.status(400).json({ error: "معرّف المنتج مطلوب" });
      return;
    }

    // Variant + product info
    const [variantInfo] = await db
      .select({
        variantId: productVariantsTable.id,
        sku: productVariantsTable.sku,
        barcode: productVariantsTable.barcode,
        sellingPrice: productVariantsTable.sellingPrice,
        costPrice: productVariantsTable.costPrice,
        productId: productsTable.id,
        productName: productsTable.name,
        basePrice: productsTable.basePrice,
        baseCostPrice: productsTable.baseCostPrice,
        reorderPoint: productsTable.reorderPoint,
        categoryName: categoriesTable.name,
        brandName: brandsTable.name,
        colorName: colorsTable.name,
        sizeName: sizesTable.name,
      })
      .from(productVariantsTable)
      .innerJoin(productsTable, eq(productsTable.id, productVariantsTable.productId))
      .leftJoin(categoriesTable, eq(categoriesTable.id, productsTable.categoryId))
      .leftJoin(brandsTable, eq(brandsTable.id, productsTable.brandId))
      .leftJoin(colorsTable, eq(colorsTable.id, productVariantsTable.colorId))
      .leftJoin(sizesTable, eq(sizesTable.id, productVariantsTable.sizeId))
      .where(
        and(
          eq(productVariantsTable.id, variantId),
          eq(productVariantsTable.storeId, storeId),
        ),
      )
      .limit(1);

    if (!variantInfo) {
      res.status(404).json({ error: "المنتج غير موجود" });
      return;
    }

    // Current stock across all warehouses
    const stockRows = await db
      .select({
        warehouseName: warehousesTable.name,
        quantity: inventoryItemsTable.quantity,
      })
      .from(inventoryItemsTable)
      .leftJoin(warehousesTable, eq(warehousesTable.id, inventoryItemsTable.warehouseId))
      .where(
        and(
          eq(inventoryItemsTable.variantId, variantId),
          eq(inventoryItemsTable.storeId, storeId),
        ),
      );

    const totalStock = stockRows.reduce((s, r) => s + (r.quantity ?? 0), 0);

    // Movement history
    const movConditions: SQL[] = [
      eq(inventoryMovementsTable.variantId, variantId),
      eq(inventoryMovementsTable.storeId, storeId),
    ];
    if (fromDateStr) {
      const from = new Date(fromDateStr);
      if (!isNaN(from.getTime())) movConditions.push(gte(inventoryMovementsTable.createdAt, from));
    }
    if (toDateStr) {
      const to = new Date(toDateStr);
      if (!isNaN(to.getTime())) { to.setHours(23, 59, 59, 999); movConditions.push(lte(inventoryMovementsTable.createdAt, to)); }
    }

    const movements = await db
      .select({
        id: inventoryMovementsTable.id,
        type: inventoryMovementsTable.type,
        quantityChange: inventoryMovementsTable.quantityChange,
        balanceAfter: inventoryMovementsTable.balanceAfter,
        referenceType: inventoryMovementsTable.referenceType,
        referenceId: inventoryMovementsTable.referenceId,
        notes: inventoryMovementsTable.notes,
        warehouseName: warehousesTable.name,
        createdAt: inventoryMovementsTable.createdAt,
      })
      .from(inventoryMovementsTable)
      .leftJoin(warehousesTable, eq(warehousesTable.id, inventoryMovementsTable.warehouseId))
      .where(and(...movConditions))
      .orderBy(asc(inventoryMovementsTable.createdAt));

    res.json({
      variant: {
        ...variantInfo,
        effectiveSellingPrice: variantInfo.sellingPrice ?? variantInfo.basePrice,
        effectiveCostPrice: variantInfo.costPrice ?? variantInfo.baseCostPrice,
      },
      stockByWarehouse: stockRows,
      totalStock,
      movements: movements.map((m) => ({
        ...m,
        createdAt: m.createdAt instanceof Date ? m.createdAt.toISOString() : m.createdAt,
      })),
      movementCount: movements.length,
    });
  },
);

// ── Customer Statement ────────────────────────────────────────────────────────
// Full customer AR ledger with running balance, for any customer.

router.get(
  "/reports/customer-statement",
  requireAuth,
  requirePermission("reports.view"),
  async (req, res) => {
    const storeId = req.auth!.storeId;
    const customerId = String(req.query["customerId"] ?? "");
    const fromDateStr = String(req.query["fromDate"] ?? "");
    const toDateStr = String(req.query["toDate"] ?? "");

    if (!customerId) {
      res.status(400).json({ error: "معرّف العميل مطلوب" });
      return;
    }

    const [customer] = await db
      .select({
        id: customersTable.id,
        name: customersTable.name,
        phone: customersTable.phone,
        address: customersTable.address,
        creditLimit: customersTable.creditLimit,
        currentBalance: customersTable.currentBalance,
      })
      .from(customersTable)
      .where(
        and(
          eq(customersTable.id, customerId),
          eq(customersTable.storeId, storeId),
        ),
      )
      .limit(1);

    if (!customer) {
      res.status(404).json({ error: "العميل غير موجود" });
      return;
    }

    const txConditions: SQL[] = [
      eq(customerTransactionsTable.customerId, customerId),
      eq(customerTransactionsTable.storeId, storeId),
    ];
    if (fromDateStr) {
      const from = new Date(fromDateStr);
      if (!isNaN(from.getTime())) txConditions.push(gte(customerTransactionsTable.createdAt, from));
    }
    if (toDateStr) {
      const to = new Date(toDateStr);
      if (!isNaN(to.getTime())) { to.setHours(23, 59, 59, 999); txConditions.push(lte(customerTransactionsTable.createdAt, to)); }
    }

    const txRows = await db
      .select({
        id: customerTransactionsTable.id,
        type: customerTransactionsTable.type,
        debit: customerTransactionsTable.debit,
        credit: customerTransactionsTable.credit,
        balanceAfter: customerTransactionsTable.balanceAfter,
        referenceType: customerTransactionsTable.referenceType,
        referenceId: customerTransactionsTable.referenceId,
        description: customerTransactionsTable.description,
        createdAt: customerTransactionsTable.createdAt,
        invoiceNumber: invoicesTable.invoiceNumber,
      })
      .from(customerTransactionsTable)
      .leftJoin(
        invoicesTable,
        and(
          eq(customerTransactionsTable.referenceType, "INVOICE"),
          eq(customerTransactionsTable.referenceId, invoicesTable.id),
        ),
      )
      .where(and(...txConditions))
      .orderBy(asc(customerTransactionsTable.createdAt));

    let totalDebit = 0;
    let totalCredit = 0;
    for (const r of txRows) {
      totalDebit += toNum(r.debit);
      totalCredit += toNum(r.credit);
    }

    res.json({
      customer,
      rows: txRows.map((r) => ({ ...r, createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : r.createdAt })),
      totalDebit,
      totalCredit,
      count: txRows.length,
    });
  },
);

// ── Daily Sales Breakdown ─────────────────────────────────────────────────────
// Revenue per day in a date range, with invoice count and payment breakdown.

router.get(
  "/reports/daily-sales",
  requireAuth,
  requirePermission("reports.sales"),
  async (req, res) => {
    const storeId = req.auth!.storeId;
    const fromDateStr = String(req.query["fromDate"] ?? "");
    const toDateStr = String(req.query["toDate"] ?? "");

    const conditions: SQL[] = [eq(invoicesTable.storeId, storeId)];
    if (fromDateStr) {
      const from = new Date(fromDateStr);
      if (!isNaN(from.getTime())) conditions.push(gte(invoicesTable.createdAt, from));
    }
    if (toDateStr) {
      const to = new Date(toDateStr);
      if (!isNaN(to.getTime())) { to.setHours(23, 59, 59, 999); conditions.push(lte(invoicesTable.createdAt, to)); }
    }

    const rows = await db
      .select({
        day: sql<string>`strftime('%Y-%m-%d', datetime(${invoicesTable.createdAt} / 1000, 'unixepoch'))`,
        invoiceCount: sql<number>`count(distinct ${invoicesTable.id})`,
        totalRevenue: sql<number>`CAST(coalesce(sum(cast(${invoicesTable.totalAmount} as REAL)), 0) AS REAL)`,
        totalCost: sql<number>`CAST(coalesce(sum(cast(${invoicesTable.totalCost} as REAL)), 0) AS REAL)`,
        avgSale: sql<number>`CAST(coalesce(avg(cast(${invoicesTable.totalAmount} as REAL)), 0) AS REAL)`,
      })
      .from(invoicesTable)
      .where(and(...conditions))
      .groupBy(sql`strftime('%Y-%m-%d', datetime(${invoicesTable.createdAt} / 1000, 'unixepoch'))`)
      .orderBy(asc(sql`strftime('%Y-%m-%d', datetime(${invoicesTable.createdAt} / 1000, 'unixepoch'))`));

    const grandTotal = rows.reduce((s, r) => s + Number(r.totalRevenue ?? 0), 0);
    const grandCost = rows.reduce((s, r) => s + Number(r.totalCost ?? 0), 0);
    const grandProfit = grandTotal - grandCost;

    res.json({ rows, grandTotal, grandCost, grandProfit, dayCount: rows.length });
  },
);

// ── Salary Summary ────────────────────────────────────────────────────────────
// Salary records for all or specific employee, with period totals.

router.get(
  "/reports/salary-summary",
  requireAuth,
  requirePermission("reports.view"),
  async (req, res) => {
    const storeId = req.auth!.storeId;
    const employeeId = String(req.query["employeeId"] ?? "");
    const fromDateStr = String(req.query["fromDate"] ?? "");
    const toDateStr = String(req.query["toDate"] ?? "");

    const conditions: SQL[] = [eq(salaryRecordsTable.storeId, storeId)];
    if (employeeId) conditions.push(eq(salaryRecordsTable.employeeId, employeeId));
    if (fromDateStr) conditions.push(gte(salaryRecordsTable.periodMonth, fromDateStr.slice(0, 7)));
    if (toDateStr) conditions.push(lte(salaryRecordsTable.periodMonth, toDateStr.slice(0, 7)));

    const rows = await db
      .select({
        id: salaryRecordsTable.id,
        employeeName: employeesTable.name,
        jobTitle: employeesTable.jobTitle,
        periodMonth: salaryRecordsTable.periodMonth,
        payPeriodType: salaryRecordsTable.payPeriodType,
        baseSalary: salaryRecordsTable.baseSalary,
        bonuses: salaryRecordsTable.bonuses,
        advanceDeduction: salaryRecordsTable.advanceDeduction,
        otherDeductions: salaryRecordsTable.otherDeductions,
        netAmount: salaryRecordsTable.netAmount,
        status: salaryRecordsTable.status,
        paidAt: salaryRecordsTable.paidAt,
        treasuryName: treasuryAccountsTable.name,
      })
      .from(salaryRecordsTable)
      .innerJoin(employeesTable, eq(employeesTable.id, salaryRecordsTable.employeeId))
      .leftJoin(treasuryAccountsTable, eq(treasuryAccountsTable.id, salaryRecordsTable.treasuryAccountId))
      .where(and(...conditions))
      .orderBy(desc(salaryRecordsTable.periodMonth), employeesTable.name);

    const totalNet = rows.reduce((s, r) => s + toNum(r.netAmount), 0);
    const totalBase = rows.reduce((s, r) => s + toNum(r.baseSalary), 0);
    const totalBonuses = rows.reduce((s, r) => s + toNum(r.bonuses), 0);
    const totalDeductions = rows.reduce(
      (s, r) => s + toNum(r.advanceDeduction) + toNum(r.otherDeductions),
      0,
    );
    const paidCount = rows.filter((r) => r.status === "PAID").length;

    res.json({
      rows: rows.map((r) => ({
        ...r,
        paidAt: r.paidAt instanceof Date ? r.paidAt.toISOString() : r.paidAt,
      })),
      totalNet,
      totalBase,
      totalBonuses,
      totalDeductions,
      paidCount,
      pendingCount: rows.length - paidCount,
      count: rows.length,
    });
  },
);

// ── Supplier Aging ────────────────────────────────────────────────────────────
// Groups outstanding supplier payables by age buckets (current, 30/60/90+ days).

router.get(
  "/reports/supplier-aging",
  requireAuth,
  requirePermission("reports.view"),
  async (req, res) => {
    const storeId = req.auth!.storeId;
    const now = new Date();
    const nowMs = now.getTime();
    const day30Ms = 30 * 24 * 60 * 60 * 1000;
    const day60Ms = 60 * 24 * 60 * 60 * 1000;
    const day90Ms = 90 * 24 * 60 * 60 * 1000;

    // Get suppliers with outstanding balances
    const suppliers = await db
      .select({
        id: suppliersTable.id,
        name: suppliersTable.name,
        phone: suppliersTable.phone,
        currentBalance: suppliersTable.currentBalance,
      })
      .from(suppliersTable)
      .where(
        and(
          eq(suppliersTable.storeId, storeId),
          sql`CAST(${suppliersTable.currentBalance} AS REAL) > 0`,
        ),
      )
      .orderBy(desc(sql`CAST(${suppliersTable.currentBalance} AS REAL)`));

    // For each supplier, bucket their unpaid purchase invoices by age
    const result = await Promise.all(
      suppliers.map(async (s) => {
        const invoices = await db
          .select({
            id: purchaseInvoicesTable.id,
            invoiceNumber: purchaseInvoicesTable.invoiceNumber,
            invoiceDate: purchaseInvoicesTable.invoiceDate,
            dueDate: purchaseInvoicesTable.dueDate,
            remainingBalance: purchaseInvoicesTable.remainingBalance,
            status: purchaseInvoicesTable.status,
          })
          .from(purchaseInvoicesTable)
          .where(
            and(
              eq(purchaseInvoicesTable.supplierId, s.id),
              eq(purchaseInvoicesTable.storeId, storeId),
              sql`${purchaseInvoicesTable.status} IN ('PARTIAL', 'CONFIRMED')`,
              sql`CAST(${purchaseInvoicesTable.remainingBalance} AS REAL) > 0`,
            ),
          );

        let current = 0; // 0-30 days
        let days30 = 0;  // 31-60
        let days60 = 0;  // 61-90
        let days90 = 0;  // 90+

        for (const inv of invoices) {
          const remaining = toNum(inv.remainingBalance);
          const dateRef = inv.dueDate || inv.invoiceDate;
          const invDate = dateRef ? new Date(dateRef).getTime() : nowMs;
          const ageDays = Math.floor((nowMs - invDate) / (24 * 60 * 60 * 1000));

          if (ageDays <= 30) current += remaining;
          else if (ageDays <= 60) days30 += remaining;
          else if (ageDays <= 90) days60 += remaining;
          else days90 += remaining;
        }

        return {
          supplierId: s.id,
          supplierName: s.name,
          phone: s.phone,
          totalBalance: toNum(s.currentBalance),
          current,
          days30,
          days60,
          days90,
          invoiceCount: invoices.length,
        };
      }),
    );

    const totals = result.reduce(
      (acc, r) => ({
        total: acc.total + r.totalBalance,
        current: acc.current + r.current,
        days30: acc.days30 + r.days30,
        days60: acc.days60 + r.days60,
        days90: acc.days90 + r.days90,
      }),
      { total: 0, current: 0, days30: 0, days60: 0, days90: 0 },
    );

    res.json({ rows: result, totals, generatedAt: now.toISOString() });
  },
);

export default router;
