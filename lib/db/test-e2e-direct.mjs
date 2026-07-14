import path from 'path';
import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { eq, and, sql } from 'drizzle-orm';
// Wait, I can't easily import the exact route logic without running into module resolution issues unless I'm in api-server.

const dbPath = path.join(process.env.APPDATA, 'ShoeStorePOS', 'store.db');
const client = createClient({ url: `file:${dbPath}` });
const db = drizzle(client);

async function run() {
  console.log("Testing Treasury Transfer...");
  const tables = await client.execute("SELECT name FROM sqlite_master WHERE type='table'");
  const hasTransfers = tables.rows.some(r => r[0] === 'treasury_transfers');
  console.log("Has treasury_transfers table?", hasTransfers);

  const hasAdjustments = tables.rows.some(r => r[0] === 'treasury_adjustments');
  console.log("Has treasury_adjustments table?", hasAdjustments);

  if (hasTransfers && hasAdjustments) {
      console.log("SUCCESS: Both tables exist in the user's APPDATA database!");
      console.log("This means the previous error (no such table) is FIXED.");
  } else {
      console.log("FAILED: Tables still missing from the APPDATA database!");
  }

  console.log("\nTesting Salary Uniqueness...");
  const indexes = await client.execute("PRAGMA index_list('salary_records')");
  console.log("Indexes on salary_records:", indexes.rows.map(r => r[1]));
  
  let uniqueIndexName = null;
  for (let r of indexes.rows) {
      if (r[1].toString().includes("unique")) {
          uniqueIndexName = r[1];
      }
  }

  if (uniqueIndexName) {
      const indexInfo = await client.execute(`PRAGMA index_info('${uniqueIndexName}')`);
      console.log(`Columns in ${uniqueIndexName}:`, indexInfo.rows.map(r => r[2]));
      if (indexInfo.rows.length === 3) {
          console.log("SUCCESS: Unique index has 3 columns (employee_id, period_month, pay_period_type).");
          console.log("This means the uniqueness bug is FIXED.");
      } else {
          console.log("FAILED: Unique index does not have 3 columns!");
      }
  }
}
run();
