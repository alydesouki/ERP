const { db, customersTable, eq } = require("@workspace/db");
const { sql } = require("drizzle-orm");

async function main() {
  try {
    const c = await db.select().from(customersTable).limit(1).for("update");
    console.log("Success:", c);
  } catch (e) {
    console.error("Error executing for update:", e.message);
  }
}
main();
