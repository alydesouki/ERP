import { boolean, index, numeric, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { storesTable } from "./stores";
import { usersTable } from "./users";

export const accountTypeEnum = pgEnum("accounting_account_type", [
  "ASSET",
  "LIABILITY",
  "EQUITY",
  "REVENUE",
  "EXPENSE",
]);

export const normalBalanceEnum = pgEnum("accounting_normal_balance", ["DEBIT", "CREDIT"]);

// Chart of accounts. Seeded per store from a fixed catalog (codes 1000..5200).
// `code` is the stable accounting code used by posting logic.
export const accountingAccountsTable = pgTable(
  "accounting_accounts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storeId: uuid("store_id")
      .notNull()
      .references(() => storesTable.id, { onDelete: "restrict" }),
    code: text("code").notNull(),
    name: text("name").notNull(),
    nameEn: text("name_en"),
    type: accountTypeEnum("type").notNull(),
    normalBalance: normalBalanceEnum("normal_balance").notNull(),
    isContra: boolean("is_contra").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("accounting_accounts_store_code_unique").on(table.storeId, table.code)],
);

// Journal entry header. Every financial event creates one of these with two or
// more balanced debit/credit lines.
export const accountingTransactionsTable = pgTable(
  "accounting_transactions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storeId: uuid("store_id")
      .notNull()
      .references(() => storesTable.id, { onDelete: "restrict" }),
    entryDate: timestamp("entry_date", { withTimezone: true }).notNull().defaultNow(),
    description: text("description"),
    referenceType: text("reference_type"),
    referenceId: uuid("reference_id"),
    createdBy: uuid("created_by").references(() => usersTable.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("accounting_tx_store_date_idx").on(table.storeId, table.entryDate),
    index("accounting_tx_reference_idx").on(table.referenceId, table.referenceType),
  ],
);

// Individual debit/credit line of a journal entry. Sum(debit) === Sum(credit)
// per transaction is enforced by the posting helper.
export const accountingTransactionLinesTable = pgTable(
  "accounting_transaction_lines",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storeId: uuid("store_id")
      .notNull()
      .references(() => storesTable.id, { onDelete: "restrict" }),
    transactionId: uuid("transaction_id")
      .notNull()
      .references(() => accountingTransactionsTable.id, { onDelete: "cascade" }),
    accountId: uuid("account_id")
      .notNull()
      .references(() => accountingAccountsTable.id, { onDelete: "restrict" }),
    debit: numeric("debit", { precision: 14, scale: 2 }).notNull().default("0"),
    credit: numeric("credit", { precision: 14, scale: 2 }).notNull().default("0"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("accounting_lines_tx_idx").on(table.transactionId),
    index("accounting_lines_account_idx").on(table.accountId),
  ],
);

export type AccountingAccount = typeof accountingAccountsTable.$inferSelect;
export type InsertAccountingAccount = typeof accountingAccountsTable.$inferInsert;
export type AccountingTransaction = typeof accountingTransactionsTable.$inferSelect;
export type InsertAccountingTransaction = typeof accountingTransactionsTable.$inferInsert;
export type AccountingTransactionLine = typeof accountingTransactionLinesTable.$inferSelect;
export type InsertAccountingTransactionLine = typeof accountingTransactionLinesTable.$inferInsert;
