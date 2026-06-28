import { index, integer, jsonb, numeric, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { customersTable } from "./customers";
import { productVariantsTable } from "./products";
import { storesTable } from "./stores";
import { treasuryAccountsTable } from "./treasury";
import { usersTable } from "./users";
import { warehousesTable } from "./warehouses";

// CASH = fully paid at sale; CREDIT = (partly) on the customer's account.
export const saleTypeEnum = pgEnum("sale_type", ["CASH", "CREDIT"]);
export const salePaymentStatusEnum = pgEnum("sale_payment_status", ["PAID", "PARTIAL", "UNPAID"]);
export const saleReturnStatusEnum = pgEnum("sale_return_status", [
  "NONE",
  "PARTIAL",
  "FULL",
]);
// How each payment line was tendered. CREDIT means added to customer balance.
export const paymentMethodEnum = pgEnum("payment_method", [
  "CASH",
  "CARD",
  "INSTAPAY",
  "WALLET",
  "CREDIT",
]);

// Sales invoice header. invoiceNumber is a per-store sequence; invoiceBarcode is
// printed on the receipt so returns can be located by scanning.
export const invoicesTable = pgTable(
  "invoices",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storeId: uuid("store_id")
      .notNull()
      .references(() => storesTable.id, { onDelete: "restrict" }),
    invoiceNumber: text("invoice_number").notNull(),
    invoiceBarcode: text("invoice_barcode").notNull(),
    customerId: uuid("customer_id").references(() => customersTable.id, { onDelete: "restrict" }),
    warehouseId: uuid("warehouse_id")
      .notNull()
      .references(() => warehousesTable.id, { onDelete: "restrict" }),
    saleType: saleTypeEnum("sale_type").notNull().default("CASH"),
    subtotal: numeric("subtotal", { precision: 14, scale: 2 }).notNull().default("0"),
    discountAmount: numeric("discount_amount", { precision: 14, scale: 2 }).notNull().default("0"),
    taxAmount: numeric("tax_amount", { precision: 14, scale: 2 }).notNull().default("0"),
    totalAmount: numeric("total_amount", { precision: 14, scale: 2 }).notNull().default("0"),
    // Total cost of goods sold for this invoice (sum of line costs), for profit.
    totalCost: numeric("total_cost", { precision: 14, scale: 2 }).notNull().default("0"),
    amountPaid: numeric("amount_paid", { precision: 14, scale: 2 }).notNull().default("0"),
    changeDue: numeric("change_due", { precision: 14, scale: 2 }).notNull().default("0"),
    paymentStatus: salePaymentStatusEnum("payment_status").notNull().default("PAID"),
    returnStatus: saleReturnStatusEnum("return_status").notNull().default("NONE"),
    notes: text("notes"),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => usersTable.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("invoices_store_number_unique").on(table.storeId, table.invoiceNumber),
    uniqueIndex("invoices_store_barcode_unique").on(table.storeId, table.invoiceBarcode),
    index("invoices_store_created_idx").on(table.storeId, table.createdAt),
    index("invoices_store_customer_idx").on(table.storeId, table.customerId),
    index("invoices_created_by_idx").on(table.createdBy),
  ],
);

// One cart line. unitPrice/unitCost captured at sale time (history snapshot).
export const invoiceItemsTable = pgTable(
  "invoice_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storeId: uuid("store_id")
      .notNull()
      .references(() => storesTable.id, { onDelete: "restrict" }),
    invoiceId: uuid("invoice_id")
      .notNull()
      .references(() => invoicesTable.id, { onDelete: "cascade" }),
    variantId: uuid("variant_id")
      .notNull()
      .references(() => productVariantsTable.id, { onDelete: "restrict" }),
    quantity: integer("quantity").notNull(),
    unitPrice: numeric("unit_price", { precision: 14, scale: 2 }).notNull(),
    unitCost: numeric("unit_cost", { precision: 14, scale: 2 }).notNull().default("0"),
    discountAmount: numeric("discount_amount", { precision: 14, scale: 2 }).notNull().default("0"),
    lineTotal: numeric("line_total", { precision: 14, scale: 2 }).notNull(),
    returnedQuantity: integer("returned_quantity").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("invoice_items_invoice_idx").on(table.invoiceId),
    index("invoice_items_variant_idx").on(table.variantId),
  ],
);

// A single payment tender against an invoice. Multiple per invoice allowed.
export const invoicePaymentsTable = pgTable(
  "invoice_payments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storeId: uuid("store_id")
      .notNull()
      .references(() => storesTable.id, { onDelete: "restrict" }),
    invoiceId: uuid("invoice_id")
      .notNull()
      .references(() => invoicesTable.id, { onDelete: "cascade" }),
    method: paymentMethodEnum("method").notNull(),
    treasuryAccountId: uuid("treasury_account_id").references(() => treasuryAccountsTable.id, {
      onDelete: "restrict",
    }),
    amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("invoice_payments_invoice_idx").on(table.invoiceId)],
);

// Sales return header, linked to the original invoice.
export const salesReturnsTable = pgTable(
  "sales_returns",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storeId: uuid("store_id")
      .notNull()
      .references(() => storesTable.id, { onDelete: "restrict" }),
    returnNumber: text("return_number").notNull(),
    invoiceId: uuid("invoice_id")
      .notNull()
      .references(() => invoicesTable.id, { onDelete: "restrict" }),
    warehouseId: uuid("warehouse_id")
      .notNull()
      .references(() => warehousesTable.id, { onDelete: "restrict" }),
    totalAmount: numeric("total_amount", { precision: 14, scale: 2 }).notNull().default("0"),
    totalCost: numeric("total_cost", { precision: 14, scale: 2 }).notNull().default("0"),
    refundMethod: paymentMethodEnum("refund_method").notNull().default("CASH"),
    treasuryAccountId: uuid("treasury_account_id").references(() => treasuryAccountsTable.id, {
      onDelete: "restrict",
    }),
    reason: text("reason"),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => usersTable.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("sales_returns_store_number_unique").on(table.storeId, table.returnNumber),
    index("sales_returns_invoice_idx").on(table.invoiceId),
    index("sales_returns_store_created_idx").on(table.storeId, table.createdAt),
  ],
);

export const salesReturnItemsTable = pgTable(
  "sales_return_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storeId: uuid("store_id")
      .notNull()
      .references(() => storesTable.id, { onDelete: "restrict" }),
    returnId: uuid("return_id")
      .notNull()
      .references(() => salesReturnsTable.id, { onDelete: "cascade" }),
    invoiceItemId: uuid("invoice_item_id")
      .notNull()
      .references(() => invoiceItemsTable.id, { onDelete: "restrict" }),
    variantId: uuid("variant_id")
      .notNull()
      .references(() => productVariantsTable.id, { onDelete: "restrict" }),
    quantity: integer("quantity").notNull(),
    unitPrice: numeric("unit_price", { precision: 14, scale: 2 }).notNull(),
    unitCost: numeric("unit_cost", { precision: 14, scale: 2 }).notNull().default("0"),
    lineTotal: numeric("line_total", { precision: 14, scale: 2 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("sales_return_items_return_idx").on(table.returnId)],
);

// A parked cart saved as JSON. Store-scoped (any cashier can resume). Does not
// touch inventory or finances until completed into a real invoice.
export const suspendedOrdersTable = pgTable(
  "suspended_orders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storeId: uuid("store_id")
      .notNull()
      .references(() => storesTable.id, { onDelete: "restrict" }),
    label: text("label"),
    customerId: uuid("customer_id").references(() => customersTable.id, { onDelete: "restrict" }),
    cart: jsonb("cart").notNull(),
    itemCount: integer("item_count").notNull().default(0),
    totalAmount: numeric("total_amount", { precision: 14, scale: 2 }).notNull().default("0"),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => usersTable.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("suspended_orders_store_idx").on(table.storeId, table.createdAt)],
);

export type Invoice = typeof invoicesTable.$inferSelect;
export type InsertInvoice = typeof invoicesTable.$inferInsert;
export type InvoiceItem = typeof invoiceItemsTable.$inferSelect;
export type InsertInvoiceItem = typeof invoiceItemsTable.$inferInsert;
export type InvoicePayment = typeof invoicePaymentsTable.$inferSelect;
export type InsertInvoicePayment = typeof invoicePaymentsTable.$inferInsert;
export type SalesReturn = typeof salesReturnsTable.$inferSelect;
export type InsertSalesReturn = typeof salesReturnsTable.$inferInsert;
export type SalesReturnItem = typeof salesReturnItemsTable.$inferSelect;
export type InsertSalesReturnItem = typeof salesReturnItemsTable.$inferInsert;
export type SuspendedOrder = typeof suspendedOrdersTable.$inferSelect;
export type InsertSuspendedOrder = typeof suspendedOrdersTable.$inferInsert;
