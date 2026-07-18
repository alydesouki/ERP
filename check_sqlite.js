const Database = require('better-sqlite3');
const db = new Database('sqlite.db');

try {
  console.log("Tables:");
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
  console.log(tables.map(t => t.name).join(", "));
  
  console.log("\nChecking associations:");
  const assoc = db.prepare("SELECT * FROM associations LIMIT 1").all();
  console.log(assoc);
  
  console.log("\nChecking association_transactions:");
  const trans = db.prepare("SELECT * FROM association_transactions LIMIT 1").all();
  console.log(trans);
  
} catch (e) {
  console.error("DB Error:", e.message);
}
