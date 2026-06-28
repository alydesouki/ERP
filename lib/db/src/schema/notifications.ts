import { boolean, index, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { storesTable } from "./stores";
import { usersTable } from "./users";

export const notificationTypeEnum = pgEnum("notification_type", [
  "LOW_STOCK",
  "NEGATIVE_TREASURY",
  "CUSTOMER_DEBT",
  "SUPPLIER_DEBT",
  "DAILY_SUMMARY",
  "SYSTEM",
]);

export const notificationSeverityEnum = pgEnum("notification_severity", [
  "INFO",
  "WARNING",
  "CRITICAL",
]);

// Per-user in-app notification. Real-time delivery is out of scope; the bell
// polls unread count. dedupeKey lets producers avoid spamming duplicates.
export const notificationsTable = pgTable(
  "notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storeId: uuid("store_id")
      .notNull()
      .references(() => storesTable.id, { onDelete: "restrict" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "restrict" }),
    type: notificationTypeEnum("type").notNull(),
    severity: notificationSeverityEnum("severity").notNull().default("INFO"),
    title: text("title").notNull(),
    body: text("body"),
    referenceType: text("reference_type"),
    referenceId: uuid("reference_id"),
    dedupeKey: text("dedupe_key"),
    isRead: boolean("is_read").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    readAt: timestamp("read_at", { withTimezone: true }),
  },
  (table) => [
    index("notifications_user_read_idx").on(table.userId, table.isRead, table.createdAt),
    index("notifications_store_idx").on(table.storeId),
  ],
);

export type Notification = typeof notificationsTable.$inferSelect;
export type InsertNotification = typeof notificationsTable.$inferInsert;
