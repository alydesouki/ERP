const path = require('path');
const dbPath = path.join(process.env.APPDATA, 'ShoeStorePOS', 'store.db');
const sqlitePath = path.join(__dirname, 'sqlite.db');

console.log('=== Database Investigation ===');
console.log('store.db path:', dbPath);
console.log('sqlite.db path:', sqlitePath);

const fs = require('fs');
const storeDbExists = fs.existsSync(dbPath);
const sqliteDbExists = fs.existsSync(sqlitePath);
console.log('store.db exists:', storeDbExists);
console.log('sqlite.db exists:', sqliteDbExists);

if (storeDbExists) {
  const stats = fs.statSync(dbPath);
  console.log('store.db size:', stats.size, 'bytes');
}
if (sqliteDbExists) {
  const stats = fs.statSync(sqlitePath);
  console.log('sqlite.db size:', stats.size, 'bytes');
}

// Try to use better-sqlite3 to check tables
try {
  const Database = require('better-sqlite3');
  
  if (storeDbExists) {
    const storeDb = new Database(dbPath, { readonly: true });
    const tables = storeDb.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all();
    console.log('\n=== store.db tables ===');
    tables.forEach(t => console.log(' -', t.name));
    storeDb.close();
  }

  if (sqliteDbExists) {
    const sqliteDb = new Database(sqlitePath, { readonly: true });
    const tables = sqliteDb.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all();
    console.log('\n=== sqlite.db tables ===');
    tables.forEach(t => console.log(' -', t.name));
    sqliteDb.close();
  }
} catch (e) {
  console.log('\nbetter-sqlite3 not available directly, trying libsql...');
  console.log('Error:', e.message);
}
