import { boolean, integer, numeric, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { storesTable } from "./stores";

// One settings row per store. Controls tax, receipt format, and the business
// rule toggles the SRS marks "configurable" (negative stock, below-cost discounts).
export const storeSettingsTable = pgTable(
  "store_settings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storeId: uuid("store_id")
      .notNull()
      .references(() => storesTable.id, { onDelete: "restrict" }),
    currency: text("currency").notNull().default("EGP"),
    taxEnabled: boolean("tax_enabled").notNull().default(false),
    taxRate: numeric("tax_rate", { precision: 5, scale: 2 }).notNull().default("0"),
    taxInclusive: boolean("tax_inclusive").notNull().default(false),
    receiptSize: text("receipt_size").notNull().default("80mm"),
    receiptFooter: text("receipt_footer"),
    numeralFormat: text("numeral_format").notNull().default("western"),
    allowNegativeStock: boolean("allow_negative_stock").notNull().default(false),
    allowBelowCostDiscount: boolean("allow_below_cost_discount").notNull().default(false),
    allowNegativeTreasury: boolean("allow_negative_treasury").notNull().default(false),
    requireSessionForCash: boolean("require_session_for_cash").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [uniqueIndex("store_settings_store_unique").on(table.storeId)],
);

// Per-store, per-document-kind monotonic counters used to generate human-friendly
// document numbers (invoices, returns, purchases, transfers, stock counts).
// Incremented with SELECT ... FOR UPDATE inside the document's transaction.
export const numberSequencesTable = pgTable(
  "number_sequences",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storeId: uuid("store_id")
      .notNull()
      .references(() => storesTable.id, { onDelete: "restrict" }),
    kind: text("kind").notNull(),
    prefix: text("prefix").notNull().default(""),
    padding: integer("padding").notNull().default(5),
    nextValue: integer("next_value").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [uniqueIndex("number_sequences_store_kind_unique").on(table.storeId, table.kind)],
);

export type StoreSettings = typeof storeSettingsTable.$inferSelect;
export type InsertStoreSettings = typeof storeSettingsTable.$inferInsert;
export type NumberSequence = typeof numberSequencesTable.$inferSelect;
export type InsertNumberSequence = typeof numberSequencesTable.$inferInsert;
