import { boolean, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { storesTable } from "./stores";

// Storage locations. Each store can have multiple warehouses; inventory is
// tracked per warehouse. Warehouses with stock cannot be deleted (RESTRICT via
// inventory_items FK) — they are soft-deleted via `isActive`.
export const warehousesTable = pgTable(
  "warehouses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storeId: uuid("store_id")
      .notNull()
      .references(() => storesTable.id, { onDelete: "restrict" }),
    name: text("name").notNull(),
    code: text("code"),
    address: text("address"),
    isDefault: boolean("is_default").notNull().default(false),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [uniqueIndex("warehouses_store_name_unique").on(table.storeId, table.name)],
);

export type Warehouse = typeof warehousesTable.$inferSelect;
export type InsertWarehouse = typeof warehousesTable.$inferInsert;
