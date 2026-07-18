const { DatabaseSync } = require('node:sqlite');
const files = [
  'd:\\erp final\\ERP\\artifacts\\api-server\\sqlite.db',
  'd:\\erp final\\ERP\\lib\\db\\sqlite.db',
  process.env.APPDATA + '\\ShoeStorePOS\\sqlite.db'
];
for (const f of files) {
  try {
    const db = new DatabaseSync(f);
    const count = db.prepare('SELECT count(*) as c FROM invoices').get();
    console.log(f, count);
  } catch(e) {
    console.log(f, e.message);
  }
}
