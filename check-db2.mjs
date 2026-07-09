import path from 'path';
import { createClient } from '@libsql/client';

const dbPath = path.join(process.env.APPDATA, 'ShoeStorePOS', 'store.db');
console.log('Checking DB:', dbPath);

const db = createClient({ url: `file:${dbPath}` });

// Get all tables
const tables = await db.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name");
console.log('\n=== Tables in store.db ===');
tables.rows.forEach(r => console.log(' -', r[0]));

// Check specific new tables
const newTables = ['treasury_transfers', 'treasury_adjustments'];
console.log('\n=== Checking new tables ===');
for (const t of newTables) {
  const exists = tables.rows.some(r => r[0] === t);
  console.log(` ${t}: ${exists ? 'EXISTS ✓' : 'MISSING ✗'}`);
  if (exists) {
    const cols = await db.execute(`PRAGMA table_info("${t}")`);
    console.log(`   Columns: ${cols.rows.map(r => r[1]).join(', ')}`);
  }
}

// Check finance tables
const financeTables = ['employee_advances', 'salary_records', 'employees', 'expenses'];
console.log('\n=== Finance tables ===');
for (const t of financeTables) {
  const exists = tables.rows.some(r => r[0] === t);
  console.log(` ${t}: ${exists ? 'EXISTS ✓' : 'MISSING ✗'}`);
  if (exists) {
    const cols = await db.execute(`PRAGMA table_info("${t}")`);
    console.log(`   Columns: ${cols.rows.map(r => r[1]).join(', ')}`);
  }
}

// Check salary_records columns specifically 
console.log('\n=== salary_records detail ===');
try {
  const cols = await db.execute(`PRAGMA table_info("salary_records")`);
  cols.rows.forEach(r => console.log(`  col[${r[0]}] ${r[1]} ${r[2]}`));
} catch(e) {
  console.log(' Not found or error:', e.message);
}

// Check accounting accounts
console.log('\n=== Accounting accounts ===');
try {
  const accts = await db.execute("SELECT code, name FROM accounting_accounts ORDER BY code");
  accts.rows.forEach(r => console.log(` [${r[0]}] ${r[1]}`));
} catch(e) {
  console.log(' Error:', e.message);
}

await db.close();
