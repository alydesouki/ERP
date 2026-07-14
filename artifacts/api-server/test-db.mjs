import { db, treasuryTransfersTable, salaryRecordsTable } from "@workspace/db";
import { count } from "drizzle-orm";
async function run() {
  try {
    const res = await db.select({ c: count() }).from(treasuryTransfersTable);
    console.log("treasury_transfers rows:", res);
  } catch (err) {
    console.error("error:", err.message);
  }
}
run();
