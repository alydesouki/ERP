import path from 'path';
import { createClient } from '@libsql/client';

const dbPath = path.join(process.env.APPDATA, 'ShoeStorePOS', 'store.db');
const db = createClient({ url: `file:${dbPath}` });

async function run() {
  console.log("=== Users ===");
  const users = await db.execute("SELECT id, username, store_id FROM users");
  console.log(users.rows);
}
run();
