import { createClient } from "@libsql/client";
import path from "path";
import process from "process";

const dbPath = "C:\\Users\\ali.ahmed0353\\Desktop\\Erp-store\\sqlite.db";
const client = createClient({ url: `file:${dbPath}` });

async function checkDatabase() {
  const result = await client.execute("SELECT name FROM sqlite_master WHERE type='table'");
  console.log("Tables found:", result.rows.map(r => r.name));
}

checkDatabase().catch(console.error);
