// Applies drizzle/ to DATABASE_URL_UNPOOLED, Neon's direct URL. The advisory lock belongs to the
// session, which a pooler in transaction mode doesn't keep, so a pooled host is refused.
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { fileURLToPath } from "node:url";
import { Client } from "pg";
import { databaseHost, isPooled } from "./guard";

const url = process.env.DATABASE_URL_UNPOOLED;
if (!url) throw new Error("Set DATABASE_URL_UNPOOLED, the direct (unpooled) URL.");
if (isPooled(databaseHost(url))) throw new Error("DATABASE_URL_UNPOOLED is a pooled host.");

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
