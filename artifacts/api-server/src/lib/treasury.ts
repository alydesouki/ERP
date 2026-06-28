import { and, eq } from "drizzle-orm";
import { db, treasuryAccountsTable, treasuryTransactionsTable } from "@workspace/db";
import { money, toNum } from "./money";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export type TreasuryDirection = "IN" | "OUT";
export type TreasuryRefType =
  | "SALE"
  | "SALES_RETURN"
  | "PURCHASE"
  | "PURCHASE_RETURN"
  | "EXPENSE"
  | "SALARY"
  | "WITHDRAWAL"
  | "DEPOSIT"
  | "CUSTOMER_PAYMENT"
  | "SUPPLIER_PAYMENT"
  | "OPENING";

export interface TreasuryPosting {
  storeId: string;
  treasuryAccountId: string;
  direction: TreasuryDirection;
  amount: number;
  referenceType: TreasuryRefType;
  referenceId?: string | null;
  sessionId?: string | null;
  description?: string | null;
  userId?: string | null;
  allowNegative?: boolean;
}

// Posts a single immutable treasury movement inside the caller's transaction:
// locks the drawer row (FOR UPDATE), updates its cached balance, and writes a
// ledger row carrying the resulting balanceAfter. Throws INSUFFICIENT_TREASURY
// when a withdrawal would overdraw a drawer that does not allow negatives.
export async function postTreasuryTransaction(
  tx: Tx,
  p: TreasuryPosting,
): Promise<{ id: string; balanceAfter: string }> {
  const [acct] = await tx
    .select({ id: treasuryAccountsTable.id, balance: treasuryAccountsTable.balance })
    .from(treasuryAccountsTable)
    .where(
      and(
        eq(treasuryAccountsTable.id, p.treasuryAccountId),
        eq(treasuryAccountsTable.storeId, p.storeId),
      ),
    )
    .for("update")
    .limit(1);
  if (!acct) throw new Error("TREASURY_ACCOUNT_NOT_FOUND");

  const delta = p.direction === "IN" ? p.amount : -p.amount;
  const newBalance = toNum(acct.balance) + delta;
  if (!p.allowNegative && newBalance < 0) {
    throw new Error("INSUFFICIENT_TREASURY");
  }

  await tx
    .update(treasuryAccountsTable)
    .set({ balance: money(newBalance) })
    .where(eq(treasuryAccountsTable.id, acct.id));

  const [row] = await tx
    .insert(treasuryTransactionsTable)
    .values({
      storeId: p.storeId,
      treasuryAccountId: acct.id,
      sessionId: p.sessionId ?? null,
      direction: p.direction,
      amount: money(p.amount),
      balanceAfter: money(newBalance),
      referenceType: p.referenceType,
      referenceId: p.referenceId ?? null,
      description: p.description ?? null,
      createdBy: p.userId ?? null,
    })
    .returning({ id: treasuryTransactionsTable.id });

  return { id: row.id, balanceAfter: money(newBalance) };
}
