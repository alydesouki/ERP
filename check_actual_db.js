const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const appData = process.env.APPDATA;
const dbPath = path.join(appData, 'ShoeStorePOS', 'store.db');

console.log("Checking DB:", dbPath);

try {
  const db = new Database(dbPath);
  
  // Try associations
  try {
    const assoc = db.prepare("SELECT * FROM associations LIMIT 1").all();
    console.log("Associations OK:", assoc.length);
  } catch (e) {
    console.error("Associations error:", e.message);
  }

  // Try association transactions
  try {
    const trans = db.prepare("SELECT * FROM association_transactions LIMIT 1").all();
    console.log("Transactions OK:", trans.length);
  } catch (e) {
    console.error("Transactions error:", e.message);
  }

} catch (err) {
  console.error("Fatal:", err.message);
}
