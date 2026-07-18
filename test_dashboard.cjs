import { db, invoicesTable, purchaseInvoicesTable, expensesTable, treasuryAccountsTable, customersTable, suppliersTable, salesReturnsTable, inventoryItemsTable, productVariantsTable, productsTable, associationsTable, associationTransactionsTable } from "./artifacts/db/dist/index.cjs";
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
    const [salesAgg] = await db.select({
      revenue: sql`CAST(coalesce(sum(${invoicesTable.totalAmount}), 0) AS REAL)`,
      cost: sql`CAST(coalesce(sum(${invoicesTable.totalCost}), 0) AS REAL)`,
    }).from(invoicesTable).where(and(...conditions));
    console.log("Sales:", salesAgg);
  } catch(err) {
    console.error("FAILED AT Sales", err);
  }
  
  try {
    const [treasuryAgg] = await db.select({
      balance: sql`CAST(coalesce(sum(${treasuryAccountsTable.balance}), 0) AS REAL)`,
    }).from(treasuryAccountsTable).where(eq(treasuryAccountsTable.storeId, storeId));
    console.log("Treasury:", treasuryAgg);
  } catch(err) {
    console.error("FAILED AT Treasury", err);
  }

  process.exit(0);
}
run();
