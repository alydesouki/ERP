import { boolean, index, numeric, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { storesTable } from "./stores";

// Suppliers are required for all purchases. currentBalance is what the store
// owes the supplier (a payable); kept in sync with supplier_transactions.
export const suppliersTable = pgTable(
  "suppliers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storeId: uuid("store_id")
      .notNull()
      .references(() => storesTable.id, { onDelete: "restrict" }),
    name: text("name").notNull(),
    phone: text("phone").notNull(),
    address: text("address"),
    taxNumber: text("tax_number"),
    // Positive balance = store owes the supplier.
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
    index("suppliers_store_name_idx").on(table.storeId, table.name),
    index("suppliers_store_phone_idx").on(table.storeId, table.phone),
  ],
);

export const supplierTxTypeEnum = pgEnum("supplier_tx_type", [
  "PURCHASE",
  "PAYMENT",
  "RETURN",
  "OPENING_BALANCE",
  "ADJUSTMENT",
]);

// Immutable running-balance ledger for a supplier. credit increases what the
// store owes; debit (payment/return) decreases it. balanceAfter is the payable.
export const supplierTransactionsTable = pgTable(
  "supplier_transactions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storeId: uuid("store_id")
      .notNull()
      .references(() => storesTable.id, { onDelete: "restrict" }),
    supplierId: uuid("supplier_id")
      .notNull()
      .references(() => suppliersTable.id, { onDelete: "restrict" }),
    type: supplierTxTypeEnum("type").notNull(),
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
    index("supplier_tx_supplier_idx").on(table.supplierId, table.createdAt),
    index("supplier_tx_store_idx").on(table.storeId),
  ],
);

export type Supplier = typeof suppliersTable.$inferSelect;
export type InsertSupplier = typeof suppliersTable.$inferInsert;
export type SupplierTransaction = typeof supplierTransactionsTable.$inferSelect;
export type InsertSupplierTransaction = typeof supplierTransactionsTable.$inferInsert;
