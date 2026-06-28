import { boolean, index, numeric, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { storesTable } from "./stores";

// Customers are OPTIONAL in this system — most sales are anonymous walk-in cash
// sales. A customer account exists mainly to track credit (debt) and history.
// currentBalance is a cached running balance kept in sync with customer_transactions.
export const customersTable = pgTable(
  "customers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storeId: uuid("store_id")
      .notNull()
      .references(() => storesTable.id, { onDelete: "restrict" }),
    name: text("name").notNull(),
    phone: text("phone").notNull(),
    address: text("address"),
    creditLimit: numeric("credit_limit", { precision: 14, scale: 2 }).notNull().default("0"),
    // Positive balance = customer owes the store (debt).
    currentBalance: numeric("current_balance", { precision: 14, scale: 2 }).notNull().default("0"),
    notes: text("notes"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("customers_store_name_idx").on(table.storeId, table.name),
    index("customers_store_phone_idx").on(table.storeId, table.phone),
  ],
);

// What kind of ledger entry this is. INVOICE/RETURN affect debt; PAYMENT reduces it.
export const customerTxTypeEnum = pgEnum("customer_tx_type", [
  "INVOICE",
  "PAYMENT",
  "RETURN",
  "OPENING_BALANCE",
  "ADJUSTMENT",
]);

// Immutable running-balance ledger for a customer. debit increases what the
// customer owes; credit decreases it. balanceAfter is the resulting debt.
export const customerTransactionsTable = pgTable(
  "customer_transactions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storeId: uuid("store_id")
      .notNull()
      .references(() => storesTable.id, { onDelete: "restrict" }),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customersTable.id, { onDelete: "restrict" }),
    type: customerTxTypeEnum("type").notNull(),
    debit: numeric("debit", { precision: 14, scale: 2 }).notNull().default("0"),
    credit: numeric("credit", { precision: 14, scale: 2 }).notNull().default("0"),
    balanceAfter: numeric("balance_after", { precision: 14, scale: 2 }).notNull(),
    referenceType: text("reference_type"),
    referenceId: uuid("reference_id"),
    description: text("description"),
    createdBy: uuid("created_by"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("customer_tx_customer_idx").on(table.customerId, table.createdAt),
    index("customer_tx_store_idx").on(table.storeId),
  ],
);

export type Customer = typeof customersTable.$inferSelect;
export type InsertCustomer = typeof customersTable.$inferInsert;
export type CustomerTransaction = typeof customerTransactionsTable.$inferSelect;
export type InsertCustomerTransaction = typeof customerTransactionsTable.$inferInsert;
