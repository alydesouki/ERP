import { boolean, numeric, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

// Tenant root. One row per store/tenant. `isSetupComplete` gates the Setup
// Wizard — it runs only while no completed store exists.
export const storesTable = pgTable("stores", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  phone: text("phone"),
  address: text("address"),
  city: text("city"),
  currency: text("currency").notNull().default("EGP"),
  taxRate: numeric("tax_rate", { precision: 5, scale: 2 }).notNull().default("0"),
  logoUrl: text("logo_url"),
  receiptPrinterWidth: text("receipt_printer_width").notNull().default("80mm"),
  receiptPaperType: text("receipt_paper_type"),
  isSetupComplete: boolean("is_setup_complete").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export type Store = typeof storesTable.$inferSelect;
export type InsertStore = typeof storesTable.$inferInsert;
