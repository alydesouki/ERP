import { createClient } from "@libsql/client";
import process from "process";

async function clearDatabase(dbPath) {
  const client = createClient({ url: `file:${dbPath}` });
  const result = await client.execute("SELECT name FROM sqlite_master WHERE type='table'");
  
  let clearedCount = 0;
  for (const row of result.rows) {
    const tableName = row.name;
    if (tableName !== "sqlite_sequence" && !tableName.startsWith("sqlite_") && !tableName.startsWith("__drizzle")) {
      console.log(`[${dbPath}] Clearing table: ${tableName}`);
      await client.execute(`DELETE FROM "${tableName}"`);
      clearedCount++;
    }
  }
  console.log(`[${dbPath}] Cleared ${clearedCount} tables.`);
}

async function main() {
  const dbs = [
    "C:\\Users\\ali.ahmed0353\\Desktop\\Erp-store\\artifacts\\api-server\\sqlite.db",
    "C:\\Users\\ali.ahmed0353\\Desktop\\Erp-store\\lib\\db\\sqlite.db"
  ];
  
  for (const db of dbs) {
    try {
      await clearDatabase(db);
    } catch (e) {
      console.error(`Error clearing ${db}:`, e.message);
    }
  }
}

main().catch(console.error);
