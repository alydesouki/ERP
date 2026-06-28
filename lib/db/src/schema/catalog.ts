import { boolean, integer, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { storesTable } from "./stores";

// Master data lists used to build products and variants. All are tenant-scoped
// and soft-deleted via `isActive` to preserve historical references from
// products/variants that point at them.

export const categoriesTable = pgTable(
  "categories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storeId: uuid("store_id")
      .notNull()
      .references(() => storesTable.id, { onDelete: "restrict" }),
    name: text("name").notNull(),
    nameEn: text("name_en"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [uniqueIndex("categories_store_name_unique").on(table.storeId, table.name)],
);

export const brandsTable = pgTable(
  "brands",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storeId: uuid("store_id")
      .notNull()
      .references(() => storesTable.id, { onDelete: "restrict" }),
    name: text("name").notNull(),
    nameEn: text("name_en"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [uniqueIndex("brands_store_name_unique").on(table.storeId, table.name)],
);

export const colorsTable = pgTable(
  "colors",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storeId: uuid("store_id")
      .notNull()
      .references(() => storesTable.id, { onDelete: "restrict" }),
    name: text("name").notNull(),
    nameEn: text("name_en"),
    hex: text("hex"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [uniqueIndex("colors_store_name_unique").on(table.storeId, table.name)],
);

export const sizesTable = pgTable(
  "sizes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storeId: uuid("store_id")
      .notNull()
      .references(() => storesTable.id, { onDelete: "restrict" }),
    // The size label (e.g. "42" or "9"). `system` distinguishes EU/US/UK.
    name: text("name").notNull(),
    system: text("system").notNull().default("EU"),
    sortOrder: integer("sort_order").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [uniqueIndex("sizes_store_system_name_unique").on(table.storeId, table.system, table.name)],
);

export type Category = typeof categoriesTable.$inferSelect;
export type InsertCategory = typeof categoriesTable.$inferInsert;
export type Brand = typeof brandsTable.$inferSelect;
export type InsertBrand = typeof brandsTable.$inferInsert;
export type Color = typeof colorsTable.$inferSelect;
export type InsertColor = typeof colorsTable.$inferInsert;
export type Size = typeof sizesTable.$inferSelect;
export type InsertSize = typeof sizesTable.$inferInsert;
