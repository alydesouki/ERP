const Database = require('../../lib/db/node_modules/better-sqlite3');
const db = new Database('sqlite.db');

const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();

let allMilliseconds = true;
let anySeconds = false;

console.log("=== Timestamp Audit ===");

for (const {name} of tables) {
  if (name.startsWith('sqlite_') || name === 'drizzle__migrations') continue;

  const columns = db.prepare(`PRAGMA table_info("${name}")`).all();
  const timestampCols = columns.filter(c => 
    c.name.includes('at') || 
    c.name.includes('time') || 
    c.name.includes('date') ||
    c.name.includes('until')
  ).map(c => c.name);

  if (timestampCols.length === 0) continue;

  const row = db.prepare(`SELECT * FROM "${name}" WHERE created_at IS NOT NULL LIMIT 1`).get();
  if (!row) {
    const fallbackRow = db.prepare(`SELECT * FROM "${name}" LIMIT 1`).get();
    if (!fallbackRow) {
      continue;
    }
    checkRow(name, fallbackRow, timestampCols);
  } else {
    checkRow(name, row, timestampCols);
  }
}

function checkRow(tableName, row, cols) {
  for (const col of cols) {
    const val = row[col];
    if (val === null || val === undefined) continue;
    if (typeof val === 'number') {
      if (val > 1000000000000) {
        console.log(`[OK] ${tableName}.${col} = ${val} (Milliseconds)`);
      } else if (val > 1000000000 && val < 2000000000) {
        console.log(`[WARN] ${tableName}.${col} = ${val} (SECONDS!)`);
        anySeconds = true;
        allMilliseconds = false;
      }
    }
  }
}

console.log("=== Audit Complete ===");
console.log("All timestamps are milliseconds:", allMilliseconds);
console.log("Any seconds found:", anySeconds);
