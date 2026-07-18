import { db, invoicesTable } from "@workspace/db";
import { sql } from "drizzle-orm";

async function main() {
  try {
    const res = await db.select({
      count: sql`count(*)`,
    }).from(invoicesTable);
    console.log("Invoices count:", res);
  } catch (err) {
    console.error("DB Error:", err);
  }
  process.exit(0);
}
main();
