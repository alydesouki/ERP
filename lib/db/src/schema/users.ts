import {
  boolean,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { rolesTable } from "./roles";
import { storesTable } from "./stores";

// Application users. Username is unique per store. Passwords are stored as
// bcrypt hashes only. Account lockout fields support the 5-failures/15-minutes
// rule. Users are soft-deleted to preserve historical references.
export const usersTable = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storeId: uuid("store_id")
      .notNull()
      .references(() => storesTable.id, { onDelete: "restrict" }),
    roleId: uuid("role_id")
      .notNull()
      .references(() => rolesTable.id, { onDelete: "restrict" }),
    username: text("username").notNull(),
    passwordHash: text("password_hash").notNull(),
    fullName: text("full_name").notNull(),
    phone: text("phone"),
    email: text("email"),
    isActive: boolean("is_active").notNull().default(true),
    failedLoginAttempts: integer("failed_login_attempts").notNull().default(0),
    lockedUntil: timestamp("locked_until", { withTimezone: true }),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
    isDeleted: boolean("is_deleted").notNull().default(false),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [uniqueIndex("users_store_username_unique").on(table.storeId, table.username)],
);

export type User = typeof usersTable.$inferSelect;
export type InsertUser = typeof usersTable.$inferInsert;
