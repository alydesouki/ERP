import {
  boolean,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { storesTable } from "./stores";

// Per-store roles. `permissions` is a JSONB array of permission keys from the
// shared catalog (@workspace/shared). System roles are seeded on setup and
// cannot be deleted.
export const rolesTable = pgTable(
  "roles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storeId: uuid("store_id")
      .notNull()
      .references(() => storesTable.id, { onDelete: "restrict" }),
    name: text("name").notNull(),
    nameAr: text("name_ar"),
    permissions: jsonb("permissions").$type<string[]>().notNull().default([]),
    isSystem: boolean("is_system").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [uniqueIndex("roles_store_name_unique").on(table.storeId, table.name)],
);

export type Role = typeof rolesTable.$inferSelect;
export type InsertRole = typeof rolesTable.$inferInsert;
