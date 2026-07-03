import { drizzle } from "drizzle-orm/libsql";
import { createClient } from "@libsql/client";
import * as schema from "./schema";
import path from "path";

// Initialize SQLite database
const sqlitePath = process.env.DATABASE_URL || path.join(process.cwd(), "sqlite.db");
const sqlite = createClient({ url: `file:${sqlitePath}` });

export const db = drizzle(sqlite, { schema });

export * from "./schema";
