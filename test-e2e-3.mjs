import path from 'path';
import { createClient } from '@libsql/client';

const dbPath = path.join(process.env.APPDATA, 'ShoeStorePOS', 'store.db');
const db = createClient({ url: `file:${dbPath}` });

async function run() {
  console.log("=== Testing Treasury ===");
  const accounts = await db.execute("SELECT * FROM treasury_accounts");
  if (accounts.rows.length < 2) {
    console.log("Need at least 2 accounts.");
    return;
  }

  const acc1 = accounts.rows[0];
  const acc2 = accounts.rows[1];
  
  console.log(`Acc1: ${acc1.name} (ID: ${acc1.id}), Balance: ${acc1.balance}`);
  console.log(`Acc2: ${acc2.name} (ID: ${acc2.id}), Balance: ${acc2.balance}`);

  console.log("\nTesting API directly using fetch via HTTP...");
}
run();
