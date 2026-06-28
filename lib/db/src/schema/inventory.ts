import { index, integer, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { productVariantsTable } from "./products";
import { storesTable } from "./stores";
import { usersTable } from "./users";
import { warehousesTable } from "./warehouses";

// All ways stock can move. IN types add quantity, OUT types subtract. Phase 2
// uses ADJUSTMENT_* (manual) and STOCK_COUNT_CORRECTION; SALE/PURCHASE/TRANSFER
// types are reserved for later phases.
export const movementTypeEnum = pgEnum("movement_type", [
  "SALE",
  "SALE_RETURN",
  "PURCHASE",
  "PURCHASE_RETURN",
  "ADJUSTMENT_IN",
  "ADJUSTMENT_OUT",
  "TRANSFER_OUT",
  "TRANSFER_IN",
  "STOCK_COUNT_CORRECTION",
]);

// Cached current stock per variant per warehouse. The authoritative history is
// inventory_movements; this row is kept in sync inside the same transaction as
// each movement so reads stay fast.
export const inventoryItemsTable = pgTable(
  "inventory_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storeId: uuid("store_id")
      .notNull()
      .references(() => storesTable.id, { onDelete: "restrict" }),
    variantId: uuid("variant_id")
      .notNull()
      .references(() => productVariantsTable.id, { onDelete: "restrict" }),
    warehouseId: uuid("warehouse_id")
      .notNull()
      .references(() => warehousesTable.id, { onDelete: "restrict" }),
    quantity: integer("quantity").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("inventory_items_variant_warehouse_unique").on(table.variantId, table.warehouseId),
    index("inventory_items_store_idx").on(table.storeId),
  ],
);

// Immutable append-only ledger of every stock change. Never updated or deleted.
export const inventoryMovementsTable = pgTable(
  "inventory_movements",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storeId: uuid("store_id")
      .notNull()
      .references(() => storesTable.id, { onDelete: "restrict" }),
    variantId: uuid("variant_id")
      .notNull()
      .references(() => productVariantsTable.id, { onDelete: "restrict" }),
    warehouseId: uuid("warehouse_id")
      .notNull()
      .references(() => warehousesTable.id, { onDelete: "restrict" }),
    type: movementTypeEnum("type").notNull(),
    // Signed change: positive for IN, negative for OUT.
    quantityChange: integer("quantity_change").notNull(),
    // Resulting on-hand quantity after applying this movement.
    balanceAfter: integer("balance_after").notNull(),
    referenceType: text("reference_type"),
    referenceId: uuid("reference_id"),
    notes: text("notes"),
    createdBy: uuid("created_by").references(() => usersTable.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("movements_variant_warehouse_store_idx").on(table.variantId, table.warehouseId, table.storeId),
    index("movements_reference_idx").on(table.referenceId, table.referenceType),
    index("movements_store_created_idx").on(table.storeId, table.createdAt),
  ],
);

export type InventoryItem = typeof inventoryItemsTable.$inferSelect;
export type InsertInventoryItem = typeof inventoryItemsTable.$inferInsert;
export type InventoryMovement = typeof inventoryMovementsTable.$inferSelect;
export type InsertInventoryMovement = typeof inventoryMovementsTable.$inferInsert;
