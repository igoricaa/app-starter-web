// Applies drizzle/ to DATABASE_URL_UNPOOLED, Neon's direct URL (or a local server), under an
// advisory lock. scripts/guard.ts's migrationRefusal says which URLs it accepts.
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { fileURLToPath } from "node:url";
import { Client } from "pg";
import { migrationRefusal } from "./guard";

const reason = migrationRefusal(process.env);
if (reason) throw new Error(`Refusing to migrate: ${reason}`);

const client = new Client({ connectionString: process.env.DATABASE_URL_UNPOOLED });
await client.connect();
try {
  // Concurrent deploys wait here, so migrations apply one at a time. Ending the session unlocks.
  await client.query("select pg_advisory_lock(hashtext('drizzle-migrate'))");
  await migrate(drizzle({ client }), {
    migrationsFolder: fileURLToPath(new URL("../drizzle", import.meta.url)),
  });
} finally {
  await client.end();
}
