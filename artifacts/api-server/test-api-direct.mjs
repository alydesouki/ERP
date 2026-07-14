import { db } from "@workspace/db";
import { treasuryAccountsTable } from "@workspace/db/schema";
import { postTreasuryTransaction } from "./src/lib/treasury.js";

async function run() {
  try {
    const storeId = (await db.query.storesTable.findFirst()).id;
    const accts = await db.select().from(treasuryAccountsTable).where(
      (a, { eq }) => eq(a.storeId, storeId)
    ).limit(2);
    
    if (accts.length < 2) {
      console.log("Not enough accounts");
      return;
    }

    const fromAcct = accts[0];
    const toAcct = accts[1];

    console.log("Transferring 10 from", fromAcct.name, "to", toAcct.name);

    await db.transaction(async (tx) => {
      await postTreasuryTransaction(tx, {
        storeId,
        treasuryAccountId: fromAcct.id,
        direction: "OUT",
        amount: 10,
        referenceType: "TRANSFER",
        referenceId: "test-id",
        description: "test",
        userId: null,
      });

      await postTreasuryTransaction(tx, {
        storeId,
        treasuryAccountId: toAcct.id,
        direction: "IN",
        amount: 10,
        referenceType: "TRANSFER",
        referenceId: "test-id",
        description: "test",
        userId: null,
      });
    });
    console.log("Success!");
  } catch (err) {
    console.error("Error:", err);
  }
}
run();
