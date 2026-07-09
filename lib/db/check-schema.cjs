const {createClient} = require('@libsql/client');
const path = require('path');

const dbPath = path.join(process.env.APPDATA, 'ShoeStorePOS', 'store.db');
const db = createClient({ url: `file:${dbPath}` });

async function main() {
  // Check salary_records columns in detail
  console.log('=== salary_records columns ===');
  const salaryInfo = await db.execute(`PRAGMA table_info("salary_records")`);
  salaryInfo.rows.forEach(r => console.log(`  [${r[0]}] ${r[1]} ${r[2]} default=${r[4]}`));
  
  // Check if pay_period_type, advance_deduction, other_deductions exist
  const cols = salaryInfo.rows.map(r => r[1]);
  console.log('\n  pay_period_type:', cols.includes('pay_period_type') ? 'EXISTS ✓' : 'MISSING ✗');
  console.log('  advance_deduction:', cols.includes('advance_deduction') ? 'EXISTS ✓' : 'MISSING ✗');
  console.log('  other_deductions:', cols.includes('other_deductions') ? 'EXISTS ✓' : 'MISSING ✗');
  
  // Check supplier_transactions columns
  console.log('\n=== supplier_transactions columns ===');
  const suppInfo = await db.execute(`PRAGMA table_info("supplier_transactions")`);
  suppInfo.rows.forEach(r => console.log(`  [${r[0]}] ${r[1]} ${r[2]}`));

  // Check what's in the api-zod for CreateSalaryBody  
  console.log('\n=== treasury_transfers table: MISSING ===');
  const transfers = await db.execute("SELECT count(*) FROM sqlite_master WHERE type='table' AND name='treasury_transfers'");
  console.log(' exists:', transfers.rows[0][0]);
  
  console.log('\n=== treasury_adjustments table: MISSING ===');
  const adjs = await db.execute("SELECT count(*) FROM sqlite_master WHERE type='table' AND name='treasury_adjustments'");
  console.log(' exists:', adjs.rows[0][0]);
  
  await db.close();
}

main().catch(console.error);
