import { boolean, index, numeric, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { storesTable } from "./stores";
import { usersTable } from "./users";

// The kinds of money "drawers" a store keeps. One account per type per store.
export const treasuryAccountTypeEnum = pgEnum("treasury_account_type", [
  "CASH",
  "CARD",
  "INSTAPAY",
  "WALLET",
]);

export const treasuryTxDirectionEnum = pgEnum("treasury_tx_direction", ["IN", "OUT"]);

export const treasuryRefTypeEnum = pgEnum("treasury_ref_type", [
  "SALE",
  "SALES_RETURN",
  "PURCHASE",
  "PURCHASE_RETURN",
  "EXPENSE",
  "SALARY",
  "WITHDRAWAL",
  "DEPOSIT",
  "CUSTOMER_PAYMENT",
  "SUPPLIER_PAYMENT",
  "OPENING",
]);

export const treasurySessionStatusEnum = pgEnum("treasury_session_status", ["OPEN", "CLOSED"]);

// A money drawer with a cached running balance. Every money movement in the
// whole system funnels through a treasury_transactions row against one of these.
export const treasuryAccountsTable = pgTable(
  "treasury_accounts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storeId: uuid("store_id")
      .notNull()
      .references(() => storesTable.id, { onDelete: "restrict" }),
    type: treasuryAccountTypeEnum("type").notNull(),
    name: text("name").notNull(),
    balance: numeric("balance", { precision: 14, scale: 2 }).notNull().default("0"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [uniqueIndex("treasury_accounts_store_type_unique").on(table.storeId, table.type)],
);

// A daily cash-management shift. Opened with a counted opening balance; closed
// with a counted actual balance, recording any variance vs. the expected total.
export const treasurySessionsTable = pgTable(
  "treasury_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storeId: uuid("store_id")
      .notNull()
      .references(() => storesTable.id, { onDelete: "restrict" }),
    treasuryAccountId: uuid("treasury_account_id")
      .notNull()
      .references(() => treasuryAccountsTable.id, { onDelete: "restrict" }),
    status: treasurySessionStatusEnum("status").notNull().default("OPEN"),
    openingBalance: numeric("opening_balance", { precision: 14, scale: 2 }).notNull().default("0"),
    expectedClosingBalance: numeric("expected_closing_balance", { precision: 14, scale: 2 }),
    actualClosingBalance: numeric("actual_closing_balance", { precision: 14, scale: 2 }),
    variance: numeric("variance", { precision: 14, scale: 2 }),
    notes: text("notes"),
    openedBy: uuid("opened_by").references(() => usersTable.id, { onDelete: "restrict" }),
    closedBy: uuid("closed_by").references(() => usersTable.id, { onDelete: "restrict" }),
    openedAt: timestamp("opened_at", { withTimezone: true }).notNull().defaultNow(),
    closedAt: timestamp("closed_at", { withTimezone: true }),
  },
  (table) => [
    index("treasury_sessions_account_idx").on(table.treasuryAccountId, table.status),
    index("treasury_sessions_store_idx").on(table.storeId),
  ],
);

// Immutable ledger of every money movement. balanceAfter is the account balance
// right after this transaction. Never updated or deleted.
export const treasuryTransactionsTable = pgTable(
  "treasury_transactions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storeId: uuid("store_id")
      .notNull()
      .references(() => storesTable.id, { onDelete: "restrict" }),
    treasuryAccountId: uuid("treasury_account_id")
      .notNull()
      .references(() => treasuryAccountsTable.id, { onDelete: "restrict" }),
    sessionId: uuid("session_id").references(() => treasurySessionsTable.id, { onDelete: "restrict" }),
    direction: treasuryTxDirectionEnum("direction").notNull(),
    amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
    balanceAfter: numeric("balance_after", { precision: 14, scale: 2 }).notNull(),
    referenceType: treasuryRefTypeEnum("reference_type").notNull(),
    referenceId: uuid("reference_id"),
    description: text("description"),
    createdBy: uuid("created_by").references(() => usersTable.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("treasury_tx_account_idx").on(table.treasuryAccountId, table.createdAt),
    index("treasury_tx_store_created_idx").on(table.storeId, table.createdAt),
    index("treasury_tx_reference_idx").on(table.referenceId, table.referenceType),
  ],
);

export type TreasuryAccount = typeof treasuryAccountsTable.$inferSelect;
export type InsertTreasuryAccount = typeof treasuryAccountsTable.$inferInsert;
export type TreasurySession = typeof treasurySessionsTable.$inferSelect;
export type InsertTreasurySession = typeof treasurySessionsTable.$inferInsert;
export type TreasuryTransaction = typeof treasuryTransactionsTable.$inferSelect;
export type InsertTreasuryTransaction = typeof treasuryTransactionsTable.$inferInsert;
