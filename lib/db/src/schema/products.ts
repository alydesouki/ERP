import { boolean, index, integer, numeric, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { brandsTable, categoriesTable, colorsTable, sizesTable } from "./catalog";
import { storesTable } from "./stores";

// Base product definition. A product groups one or more variants (size+color
// combinations). Quantities live on inventory_items, never here. Soft-deleted
// via `isActive`; cannot be hard-deleted once it has variants with history.
export const productsTable = pgTable(
  "products",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storeId: uuid("store_id")
      .notNull()
      .references(() => storesTable.id, { onDelete: "restrict" }),
    name: text("name").notNull(),
    nameEn: text("name_en"),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => categoriesTable.id, { onDelete: "restrict" }),
    brandId: uuid("brand_id").references(() => brandsTable.id, { onDelete: "restrict" }),
    description: text("description"),
    basePrice: numeric("base_price", { precision: 10, scale: 2 }).notNull().default("0"),
    baseCostPrice: numeric("base_cost_price", { precision: 10, scale: 2 }).notNull().default("0"),
    reorderPoint: integer("reorder_point").notNull().default(0),
    barcode: text("barcode"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("products_store_name_idx").on(table.storeId, table.name),
    index("products_store_category_idx").on(table.storeId, table.categoryId),
  ],
);

// A specific size+color combination of a product, with its own SKU/barcode and
// optional price overrides (null = inherit the product base price/cost).
export const productVariantsTable = pgTable(
  "product_variants",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    productId: uuid("product_id")
      .notNull()
      .references(() => productsTable.id, { onDelete: "restrict" }),
    storeId: uuid("store_id")
      .notNull()
      .references(() => storesTable.id, { onDelete: "restrict" }),
    colorId: uuid("color_id")
      .notNull()
      .references(() => colorsTable.id, { onDelete: "restrict" }),
    sizeId: uuid("size_id")
      .notNull()
      .references(() => sizesTable.id, { onDelete: "restrict" }),
    sku: text("sku").notNull(),
    barcode: text("barcode").notNull(),
    sellingPrice: numeric("selling_price", { precision: 10, scale: 2 }),
    costPrice: numeric("cost_price", { precision: 10, scale: 2 }),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("variants_store_sku_unique").on(table.storeId, table.sku),
    uniqueIndex("variants_store_barcode_unique").on(table.storeId, table.barcode),
    uniqueIndex("variants_product_color_size_unique").on(table.productId, table.colorId, table.sizeId),
    index("variants_product_idx").on(table.productId),
  ],
);

export type Product = typeof productsTable.$inferSelect;
export type InsertProduct = typeof productsTable.$inferInsert;
export type ProductVariant = typeof productVariantsTable.$inferSelect;
export type InsertProductVariant = typeof productVariantsTable.$inferInsert;
