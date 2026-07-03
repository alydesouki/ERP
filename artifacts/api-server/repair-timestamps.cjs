const Database = require('../../lib/db/node_modules/better-sqlite3');
const db = new Database('sqlite.db');

const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();

let repairedCount = 0;

console.log("=== Timestamp Repair ===");

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

  for (const col of timestampCols) {
    const result = db.prepare(`UPDATE "${name}" SET "${col}" = "${col}" * 1000 WHERE "${col}" > 1000000000 AND "${col}" < 2000000000`).run();
    if (result.changes > 0) {
      console.log(`[FIXED] ${name}.${col}: Repaired ${result.changes} rows (Seconds -> Milliseconds).`);
      repairedCount += result.changes;
    }
  }
}

console.log("=== Repair Complete ===");
console.log(`Total rows repaired: ${repairedCount}`);
