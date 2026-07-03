const { db, invoicesTable } = require("@workspace/db");

async function main() {
  const result = await db.select().from(invoicesTable).limit(1);
  console.log("Raw invoice:", result[0]);
  if (result[0]) {
    console.log("Invoice created_at date:", result[0].createdAt.toISOString());
  }
}
main();
