import { createClient } from "@libsql/client";
import path from "path";
import process from "process";

const dbPath = "C:\\Users\\ali.ahmed0353\\Desktop\\Erp-store\\sqlite.db";
const client = createClient({ url: `file:${dbPath}` });

async function clearDatabase() {
  const result = await client.execute("SELECT name FROM sqlite_master WHERE type='table'");
  
  for (const row of result.rows) {
    const tableName = row.name;
    if (tableName !== "sqlite_sequence" && !tableName.startsWith("sqlite_") && !tableName.startsWith("__drizzle")) {
      console.log(`Clearing table: ${tableName}`);
      await client.execute(`DELETE FROM "${tableName}"`);
    }
  }
  console.log("All rows have been deleted, schema preserved.");
}

clearDatabase().catch(console.error);
