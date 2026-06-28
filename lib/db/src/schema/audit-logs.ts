import { index, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { storesTable } from "./stores";
import { usersTable } from "./users";

// Immutable audit trail. The application never issues UPDATE or DELETE on this
// table. `userId` may be null for events with no authenticated actor (e.g. a
// failed login for an unknown username).
export const auditLogsTable = pgTable(
  "audit_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storeId: uuid("store_id")
      .notNull()
      .references(() => storesTable.id, { onDelete: "restrict" }),
    userId: uuid("user_id").references(() => usersTable.id, { onDelete: "set null" }),
    action: text("action").notNull(),
    entityType: text("entity_type"),
    entityId: text("entity_id"),
    oldValue: jsonb("old_value"),
    newValue: jsonb("new_value"),
    ipAddress: text("ip_address"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("audit_logs_store_entity_idx").on(
      table.storeId,
      table.entityType,
      table.entityId,
    ),
    index("audit_logs_store_created_idx").on(table.storeId, table.createdAt),
  ],
);

export type AuditLog = typeof auditLogsTable.$inferSelect;
export type InsertAuditLog = typeof auditLogsTable.$inferInsert;
