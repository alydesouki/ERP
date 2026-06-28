import { index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { storesTable } from "./stores";
import { usersTable } from "./users";

// Refresh-token sessions. Only a hash of the refresh token is stored. Tokens
// are rotated on each use (old session revoked, new one created).
export const sessionsTable = pgTable(
  "sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storeId: uuid("store_id")
      .notNull()
      .references(() => storesTable.id, { onDelete: "restrict" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    refreshTokenHash: text("refresh_token_hash").notNull(),
    userAgent: text("user_agent"),
    ipAddress: text("ip_address"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("sessions_token_hash_idx").on(table.refreshTokenHash),
    index("sessions_user_idx").on(table.userId),
  ],
);

export type Session = typeof sessionsTable.$inferSelect;
export type InsertSession = typeof sessionsTable.$inferInsert;
