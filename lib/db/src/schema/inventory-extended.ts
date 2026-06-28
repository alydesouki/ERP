import { index, integer, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { productVariantsTable } from "./products";
import { storesTable } from "./stores";
import { usersTable } from "./users";
import { warehousesTable } from "./warehouses";

// Transfers move stock between two warehouses. Per SRS §19 rule 53, the
// destination must confirm receipt before its inventory increases, so a transfer
// has a PENDING (sent, TRANSFER_OUT booked) then COMPLETED (received, TRANSFER_IN
// booked) lifecycle.
export const transferStatusEnum = pgEnum("transfer_status", ["PENDING", "COMPLETED", "CANCELLED"]);

export const warehouseTransfersTable = pgTable(
  "warehouse_transfers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storeId: uuid("store_id")
      .notNull()
      .references(() => storesTable.id, { onDelete: "restrict" }),
    transferNumber: text("transfer_number").notNull(),
    fromWarehouseId: uuid("from_warehouse_id")
      .notNull()
      .references(() => warehousesTable.id, { onDelete: "restrict" }),
    toWarehouseId: uuid("to_warehouse_id")
      .notNull()
      .references(() => warehousesTable.id, { onDelete: "restrict" }),
    status: transferStatusEnum("status").notNull().default("PENDING"),
    notes: text("notes"),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => usersTable.id, { onDelete: "restrict" }),
    confirmedBy: uuid("confirmed_by").references(() => usersTable.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("warehouse_transfers_store_number_unique").on(table.storeId, table.transferNumber),
    index("warehouse_transfers_store_idx").on(table.storeId, table.createdAt),
  ],
);

export const warehouseTransferItemsTable = pgTable(
  "warehouse_transfer_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storeId: uuid("store_id")
      .notNull()
      .references(() => storesTable.id, { onDelete: "restrict" }),
    transferId: uuid("transfer_id")
      .notNull()
      .references(() => warehouseTransfersTable.id, { onDelete: "cascade" }),
    variantId: uuid("variant_id")
      .notNull()
      .references(() => productVariantsTable.id, { onDelete: "restrict" }),
    quantity: integer("quantity").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("warehouse_transfer_items_transfer_idx").on(table.transferId)],
);

// Physical stock-count session. Per SRS §19 rule 54 corrections need manager
// approval; applying the count books STOCK_COUNT_CORRECTION movements.
export const stockCountStatusEnum = pgEnum("stock_count_status", [
  "OPEN",
  "COMPLETED",
  "CANCELLED",
]);

export const stockCountsTable = pgTable(
  "stock_counts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storeId: uuid("store_id")
      .notNull()
      .references(() => storesTable.id, { onDelete: "restrict" }),
    countNumber: text("count_number").notNull(),
    warehouseId: uuid("warehouse_id")
      .notNull()
      .references(() => warehousesTable.id, { onDelete: "restrict" }),
    status: stockCountStatusEnum("status").notNull().default("OPEN"),
    notes: text("notes"),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => usersTable.id, { onDelete: "restrict" }),
    approvedBy: uuid("approved_by").references(() => usersTable.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("stock_counts_store_number_unique").on(table.storeId, table.countNumber),
    index("stock_counts_store_idx").on(table.storeId, table.createdAt),
  ],
);

export const stockCountItemsTable = pgTable(
  "stock_count_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storeId: uuid("store_id")
      .notNull()
      .references(() => storesTable.id, { onDelete: "restrict" }),
    countId: uuid("count_id")
      .notNull()
      .references(() => stockCountsTable.id, { onDelete: "cascade" }),
    variantId: uuid("variant_id")
      .notNull()
      .references(() => productVariantsTable.id, { onDelete: "restrict" }),
    expectedQuantity: integer("expected_quantity").notNull(),
    countedQuantity: integer("counted_quantity"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("stock_count_items_count_idx").on(table.countId)],
);

export type WarehouseTransfer = typeof warehouseTransfersTable.$inferSelect;
export type InsertWarehouseTransfer = typeof warehouseTransfersTable.$inferInsert;
export type WarehouseTransferItem = typeof warehouseTransferItemsTable.$inferSelect;
export type InsertWarehouseTransferItem = typeof warehouseTransferItemsTable.$inferInsert;
export type StockCount = typeof stockCountsTable.$inferSelect;
export type InsertStockCount = typeof stockCountsTable.$inferInsert;
export type StockCountItem = typeof stockCountItemsTable.$inferSelect;
export type InsertStockCountItem = typeof stockCountItemsTable.$inferInsert;
