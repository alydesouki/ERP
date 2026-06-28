import { date, index, integer, numeric, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { paymentMethodEnum } from "./sales";
import { productVariantsTable } from "./products";
import { storesTable } from "./stores";
import { suppliersTable } from "./suppliers";
import { treasuryAccountsTable } from "./treasury";
import { usersTable } from "./users";
import { warehousesTable } from "./warehouses";

export const purchaseStatusEnum = pgEnum("purchase_status", ["DRAFT", "CONFIRMED", "PARTIAL", "PAID"]);
export const purchaseReturnStatusEnum = pgEnum("purchase_return_status", ["NONE", "PARTIAL", "FULL"]);

// Purchase invoice header. Receives stock into one warehouse. May be paid now
// (full/partial) or fully on credit (increases supplier balance).
export const purchaseInvoicesTable = pgTable(
  "purchase_invoices",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storeId: uuid("store_id")
      .notNull()
      .references(() => storesTable.id, { onDelete: "restrict" }),
    invoiceNumber: text("invoice_number").notNull(),
    supplierInvoiceNumber: text("supplier_invoice_number"),
    supplierId: uuid("supplier_id")
      .notNull()
      .references(() => suppliersTable.id, { onDelete: "restrict" }),
    warehouseId: uuid("warehouse_id")
      .notNull()
      .references(() => warehousesTable.id, { onDelete: "restrict" }),
    invoiceDate: date("invoice_date"),
    dueDate: date("due_date"),
    subtotal: numeric("subtotal", { precision: 14, scale: 2 }).notNull().default("0"),
    taxAmount: numeric("tax_amount", { precision: 14, scale: 2 }).notNull().default("0"),
    totalAmount: numeric("total_amount", { precision: 14, scale: 2 }).notNull().default("0"),
    amountPaid: numeric("amount_paid", { precision: 14, scale: 2 }).notNull().default("0"),
    remainingBalance: numeric("remaining_balance", { precision: 14, scale: 2 }).notNull().default("0"),
    status: purchaseStatusEnum("status").notNull().default("CONFIRMED"),
    returnStatus: purchaseReturnStatusEnum("return_status").notNull().default("NONE"),
    notes: text("notes"),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => usersTable.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("purchase_invoices_store_number_unique").on(table.storeId, table.invoiceNumber),
    index("purchase_invoices_store_created_idx").on(table.storeId, table.createdAt),
    index("purchase_invoices_supplier_idx").on(table.supplierId),
  ],
);

export const purchaseInvoiceItemsTable = pgTable(
  "purchase_invoice_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storeId: uuid("store_id")
      .notNull()
      .references(() => storesTable.id, { onDelete: "restrict" }),
    purchaseId: uuid("purchase_id")
      .notNull()
      .references(() => purchaseInvoicesTable.id, { onDelete: "cascade" }),
    variantId: uuid("variant_id")
      .notNull()
      .references(() => productVariantsTable.id, { onDelete: "restrict" }),
    quantity: integer("quantity").notNull(),
    costPrice: numeric("cost_price", { precision: 14, scale: 2 }).notNull(),
    lineTotal: numeric("line_total", { precision: 14, scale: 2 }).notNull(),
    returnedQuantity: integer("returned_quantity").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("purchase_items_purchase_idx").on(table.purchaseId),
    index("purchase_items_variant_idx").on(table.variantId),
  ],
);

export const purchasePaymentsTable = pgTable(
  "purchase_payments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storeId: uuid("store_id")
      .notNull()
      .references(() => storesTable.id, { onDelete: "restrict" }),
    purchaseId: uuid("purchase_id")
      .notNull()
      .references(() => purchaseInvoicesTable.id, { onDelete: "cascade" }),
    method: paymentMethodEnum("method").notNull(),
    treasuryAccountId: uuid("treasury_account_id").references(() => treasuryAccountsTable.id, {
      onDelete: "restrict",
    }),
    amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("purchase_payments_purchase_idx").on(table.purchaseId)],
);

export const purchaseReturnsTable = pgTable(
  "purchase_returns",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storeId: uuid("store_id")
      .notNull()
      .references(() => storesTable.id, { onDelete: "restrict" }),
    returnNumber: text("return_number").notNull(),
    purchaseId: uuid("purchase_id")
      .notNull()
      .references(() => purchaseInvoicesTable.id, { onDelete: "restrict" }),
    warehouseId: uuid("warehouse_id")
      .notNull()
      .references(() => warehousesTable.id, { onDelete: "restrict" }),
    totalAmount: numeric("total_amount", { precision: 14, scale: 2 }).notNull().default("0"),
    reason: text("reason"),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => usersTable.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("purchase_returns_store_number_unique").on(table.storeId, table.returnNumber),
    index("purchase_returns_purchase_idx").on(table.purchaseId),
  ],
);

export const purchaseReturnItemsTable = pgTable(
  "purchase_return_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storeId: uuid("store_id")
      .notNull()
      .references(() => storesTable.id, { onDelete: "restrict" }),
    returnId: uuid("return_id")
      .notNull()
      .references(() => purchaseReturnsTable.id, { onDelete: "cascade" }),
    purchaseItemId: uuid("purchase_item_id")
      .notNull()
      .references(() => purchaseInvoiceItemsTable.id, { onDelete: "restrict" }),
    variantId: uuid("variant_id")
      .notNull()
      .references(() => productVariantsTable.id, { onDelete: "restrict" }),
    quantity: integer("quantity").notNull(),
    costPrice: numeric("cost_price", { precision: 14, scale: 2 }).notNull(),
    lineTotal: numeric("line_total", { precision: 14, scale: 2 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("purchase_return_items_return_idx").on(table.returnId)],
);

export type PurchaseInvoice = typeof purchaseInvoicesTable.$inferSelect;
export type InsertPurchaseInvoice = typeof purchaseInvoicesTable.$inferInsert;
export type PurchaseInvoiceItem = typeof purchaseInvoiceItemsTable.$inferSelect;
export type InsertPurchaseInvoiceItem = typeof purchaseInvoiceItemsTable.$inferInsert;
export type PurchasePayment = typeof purchasePaymentsTable.$inferSelect;
export type InsertPurchasePayment = typeof purchasePaymentsTable.$inferInsert;
export type PurchaseReturn = typeof purchaseReturnsTable.$inferSelect;
export type InsertPurchaseReturn = typeof purchaseReturnsTable.$inferInsert;
export type PurchaseReturnItem = typeof purchaseReturnItemsTable.$inferSelect;
export type InsertPurchaseReturnItem = typeof purchaseReturnItemsTable.$inferInsert;
