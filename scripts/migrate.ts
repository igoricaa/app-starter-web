// Applies drizzle/ to DATABASE_URL_UNPOOLED (Neon's direct URL), else DATABASE_URL.
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { fileURLToPath } from "node:url";
import { Client } from "pg";

const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
if (!url) throw new Error("Set DATABASE_URL.");

const client = new Client({ connectionString: url });
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
