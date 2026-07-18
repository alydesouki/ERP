import { db, invoicesTable, purchaseInvoicesTable, expensesTable, treasuryAccountsTable, customersTable, suppliersTable, salesReturnsTable, inventoryItemsTable, productVariantsTable, productsTable, associationsTable, associationTransactionsTable } from "./artifacts/db/dist/index.js";
import { sql, eq, and, gt, gte, lte } from "drizzle-orm";

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfDay(d) {
  const e = new Date(d);
  e.setHours(23, 59, 59, 999);
  return e;
}

async function run() {
  const storeId = "1";
  const today = startOfToday();
  const conditions = [eq(invoicesTable.storeId, storeId)];
  conditions.push(gte(invoicesTable.createdAt, today));
  conditions.push(lte(invoicesTable.createdAt, endOfDay(today)));

  try {
    console.log("1. Sales...");
    const [salesAgg] = await db.select({
      revenue: sql`CAST(coalesce(sum(${invoicesTable.totalAmount}), 0) AS REAL)`,
      cost: sql`CAST(coalesce(sum(${invoicesTable.totalCost}), 0) AS REAL)`,
    }).from(invoicesTable).where(and(...conditions));
    console.log("Sales:", salesAgg);

    console.log("2. Returns...");
    const [returnAgg] = await db.select({
      total: sql`CAST(coalesce(sum(${salesReturnsTable.totalAmount}), 0) AS REAL)`,
    }).from(salesReturnsTable).where(eq(salesReturnsTable.storeId, storeId));
    
    console.log("3. Treasury...");
    const [treasuryAgg] = await db.select({
      balance: sql`CAST(coalesce(sum(${treasuryAccountsTable.balance}), 0) AS REAL)`,
    }).from(treasuryAccountsTable).where(eq(treasuryAccountsTable.storeId, storeId));
    console.log("Treasury:", treasuryAgg);

    console.log("4. Inventory...");
    const lowStockRows = await db
      .select({ variantId: inventoryItemsTable.variantId })
      .from(inventoryItemsTable)
      .innerJoin(productVariantsTable, eq(productVariantsTable.id, inventoryItemsTable.variantId))
      .innerJoin(productsTable, eq(productsTable.id, productVariantsTable.productId))
      .where(and(eq(inventoryItemsTable.storeId, storeId), gt(productsTable.reorderPoint, 0)))
      .groupBy(inventoryItemsTable.variantId, productsTable.reorderPoint)
      .having(sql`sum(${inventoryItemsTable.quantity}) <= ${productsTable.reorderPoint}`);
    console.log("Inventory ok");

    console.log("5. Associations...");
    const assocTotals = await db
      .select({
        type: associationTransactionsTable.type,
        total: sql`CAST(coalesce(sum(cast(${associationTransactionsTable.amount} as REAL)), 0) AS REAL)`,
      })
      .from(associationTransactionsTable)
      .where(and(
        eq(associationTransactionsTable.storeId, storeId),
        eq(associationTransactionsTable.isReversed, false),
      ))
      .groupBy(associationTransactionsTable.type);
    console.log("Assoc:", assocTotals);
    
    console.log("All success!");
  } catch(err) {
    console.error("FAILED AT", err);
  }
  process.exit(0);
}
run();
