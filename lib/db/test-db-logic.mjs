import path from 'path';
import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { eq, and, sql } from 'drizzle-orm';
import crypto from 'crypto';

const dbPath = path.join(process.env.APPDATA, 'ShoeStorePOS', 'store.db');
const client = createClient({ url: `file:${dbPath}` });
const db = drizzle(client);

async function run() {
  console.log("=== Testing Treasury Transfer Logic ===");
  try {
    const store = (await client.execute("SELECT id FROM stores LIMIT 1")).rows[0];
    const storeId = store[0].toString();
    const accounts = await client.execute("SELECT * FROM treasury_accounts");
    
    if (accounts.rows.length < 2) {
      console.log("Need at least 2 accounts");
      return;
    }

    const fromAcct = accounts.rows[0];
    const toAcct = accounts.rows[1];
    const amount = 5;

    await db.transaction(async (tx) => {
       // Insert transfer
       const transferId = crypto.randomUUID();
       await tx.run(sql`INSERT INTO treasury_transfers (id, store_id, from_account_id, to_account_id, amount, description, created_by, created_at) VALUES (${transferId}, ${storeId}, ${fromAcct[0]}, ${toAcct[0]}, ${amount.toString()}, 'Test', null, strftime('%Y-%m-%d %H:%M:%S', 'now'))`);
       
       // Update balances
       const newFromBal = parseFloat(fromAcct[4].toString()) - amount;
       await tx.run(sql`UPDATE treasury_accounts SET balance = ${newFromBal.toString()} WHERE id = ${fromAcct[0]}`);

       const newToBal = parseFloat(toAcct[4].toString()) + amount;
       await tx.run(sql`UPDATE treasury_accounts SET balance = ${newToBal.toString()} WHERE id = ${toAcct[0]}`);
       
       // Record transactions
       const tx1 = crypto.randomUUID();
       await tx.run(sql`INSERT INTO treasury_transactions (id, store_id, treasury_account_id, direction, amount, balance_after, reference_type, reference_id) VALUES (${tx1}, ${storeId}, ${fromAcct[0]}, 'OUT', ${amount.toString()}, ${newFromBal.toString()}, 'TRANSFER', ${transferId})`);
       
       const tx2 = crypto.randomUUID();
       await tx.run(sql`INSERT INTO treasury_transactions (id, store_id, treasury_account_id, direction, amount, balance_after, reference_type, reference_id) VALUES (${tx2}, ${storeId}, ${toAcct[0]}, 'IN', ${amount.toString()}, ${newToBal.toString()}, 'TRANSFER', ${transferId})`);
    });
    console.log("SUCCESS: Treasury Transfer DB Logic Executed");
  } catch (err) {
    console.error("FAILED Treasury Transfer:", err);
  }

  console.log("\n=== Testing Salary Generation Logic ===");
  try {
    const store = (await client.execute("SELECT id FROM stores LIMIT 1")).rows[0];
    const storeId = store[0].toString();
    const empId = crypto.randomUUID();
    
    // Create employee
    await db.run(sql`INSERT INTO employees (id, store_id, name, monthly_salary, advance_balance) VALUES (${empId}, ${storeId}, 'Test Emp', '2000', '100')`);
    
    // Create salary
    const period = '2026-07-test';
    const salaryId = crypto.randomUUID();
    
    await db.transaction(async (tx) => {
       await tx.run(sql`INSERT INTO salary_records (id, store_id, employee_id, pay_period_type, period_month, base_salary, bonuses, advance_deduction, other_deductions, deductions, net_amount, status) VALUES (${salaryId}, ${storeId}, ${empId}, 'MONTHLY', ${period}, '2000', '0', '100', '0', '100', '1900', 'PENDING')`);
    });
    console.log("SUCCESS: Salary Generation DB Logic Executed");
  } catch (err) {
    console.error("FAILED Salary Generation:", err);
  }
}
run();
