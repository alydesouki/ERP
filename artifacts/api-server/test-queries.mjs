import { db, invoicesTable, purchaseInvoicesTable, inventoryItemsTable, invoiceItemsTable, invoicePaymentsTable, customersTable, storesTable } from '@workspace/db';
import { eq, and, sql, desc, gte } from 'drizzle-orm';

async function run() {
  const storeId = (await db.select().from(storesTable).limit(1))[0].id;
  console.log('Store ID:', storeId);

  // Test Sales Summary with Date (from the API)
  const fromDate = new Date('2026-05-30T00:00:00.000Z');
  const fakeDate = new Date(fromDate.getTime() * 1000); // 1000x multiplier
  
  const q1Date = db.select({ count: sql`count(*)` }).from(invoicesTable).where(
    and(
      eq(invoicesTable.storeId, storeId),
      gte(invoicesTable.createdAt, fakeDate)
    )
  );
  console.log('\n--- Sales Summary With Date ---');
  console.log('SQL:', q1Date.toSQL().sql);
  console.log('Params:', q1Date.toSQL().params);
  try {
    console.log('Rows:', await q1Date);
  } catch(e) {
    console.log('Error executing query with Date:', e.message);
  }
}

run().catch(console.error);
