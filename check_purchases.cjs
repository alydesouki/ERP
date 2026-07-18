const { DatabaseSync } = require('node:sqlite');
const db = new DatabaseSync('d:\\erp final\\ERP\\artifacts\\api-server\\sqlite.db');
const rows = db.prepare('SELECT id, invoice_number, invoice_date, total_amount, status FROM purchase_invoices ORDER BY invoice_date DESC LIMIT 10').all();
console.log(rows);
const returns = db.prepare('SELECT id, return_number, created_at, total_amount FROM purchase_returns ORDER BY created_at DESC LIMIT 10').all();
console.log('Returns:', returns);
