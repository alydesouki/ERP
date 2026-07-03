const bsql3Path = require.resolve('better-sqlite3', {paths:['../../node_modules/.pnpm/better-sqlite3@11.10.0/node_modules']});
const Database = require(bsql3Path);
const db = new Database('./sqlite.db');

// Get column names for users table
const userCols = db.prepare("PRAGMA table_info(users)").all();
console.log('User columns:', userCols.map(c => c.name));

const users = db.prepare("SELECT * FROM users LIMIT 2").all();
console.log('Users:', JSON.stringify(users, null, 2));

const warehouses = db.prepare("SELECT * FROM warehouses LIMIT 2").all();
console.log('Warehouses:', JSON.stringify(warehouses, null, 2));

const variants = db.prepare("SELECT * FROM product_variants LIMIT 2").all();
console.log('Variants (first 2):', JSON.stringify(variants, null, 2));

const treasury = db.prepare("SELECT * FROM treasury_accounts LIMIT 5").all();
console.log('Treasury:', JSON.stringify(treasury, null, 2));

const stores = db.prepare("SELECT * FROM stores LIMIT 2").all();
console.log('Stores:', JSON.stringify(stores, null, 2));

const storeSettings = db.prepare("SELECT * FROM store_settings LIMIT 2").all();
console.log('Store Settings:', JSON.stringify(storeSettings, null, 2));

const invoiceCount = db.prepare("SELECT count(*) as cnt FROM invoices").get();
console.log('Invoice count:', invoiceCount.cnt);

const acctAccounts = db.prepare("SELECT * FROM accounting_accounts LIMIT 5").all();
console.log('Accounting accounts:', JSON.stringify(acctAccounts, null, 2));
