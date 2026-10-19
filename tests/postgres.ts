// Vitest global setup, trimmed from Hive. Without TEST_DATABASE_URL (CI sets one) it starts a
// throwaway PostgreSQL 18 cluster for this run and stops it at the end. Either way it migrates a
// template database once; each test layer gets its own copy.
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { Effect } from "effect";
import { Client } from "pg";

const template = "app_template";

function serverUrl(database: string) {
  const base = process.env.TEST_DATABASE_URL;
  if (!base) throw new Error("No TEST_DATABASE_URL: the Vitest global setup did not run.");
  const url = new URL(base);
  url.pathname = `/${database}`;
  return url.toString();
}

async function admin(statement: string) {
  const client = new Client({ connectionString: serverUrl("postgres") });
  await client.connect();
  try {
    await client.query(statement);
  } finally {
    await client.end();
  }
}

const freePort = () =>
  new Promise<number>((resolve, reject) => {
    const server = createServer().listen(0, "127.0.0.1", () => {
      const { port } = server.address() as { port: number };
      server.close(() => resolve(port));
    });
    server.on("error", reject);
  });

export default async function setup() {
  let stop = () => {};
  if (!process.env.TEST_DATABASE_URL) {
    const bin = process.env.PG_BIN ?? "/opt/homebrew/opt/postgresql@18/bin";
    const directory = mkdtempSync(join(tmpdir(), "app-test-postgres-"));
    const data = join(directory, "data");
    const pg = (tool: string, args: string[]) =>
      execFileSync(join(bin, tool), args, { stdio: "ignore", env: { LC_ALL: "C" } });
    const port = await freePort();
    try {
      pg("initdb", ["-D", data, "-U", "postgres", "--auth=trust", "--encoding=UTF8"]);
      const options = `-p ${port} -k ${directory} -c listen_addresses=127.0.0.1 -c fsync=off -c synchronous_commit=off -c full_page_writes=off`;
      pg("pg_ctl", ["-D", data, "-o", options, "-w", "start"]);
    } catch (error) {
      rmSync(directory, { recursive: true, force: true });
      throw new Error(
        `Could not start PostgreSQL 18 from ${bin}: brew install postgresql@18, set PG_BIN, or set TEST_DATABASE_URL.`,
        { cause: error },
      );
    }
    stop = () => {
      try {
        pg("pg_ctl", ["-D", data, "-m", "immediate", "-w", "stop"]);
      } finally {
        rmSync(directory, { recursive: true, force: true });
      }
    };
    process.env.TEST_DATABASE_URL = `postgresql://postgres@127.0.0.1:${port}/postgres`;
  }
  try {
    await admin(`drop database if exists ${template}`);
    await admin(`create database ${template}`);
    execFileSync("bun", [fileURLToPath(new URL("../scripts/migrate.ts", import.meta.url))], {
      stdio: "inherit",
      env: { ...process.env, DATABASE_URL_UNPOOLED: serverUrl(template) },
    });
  } catch (error) {
    stop();
    throw error;
  }
  return stop;
}

// A fresh copy of the migrated template, dropped when its scope closes.
export const testDatabase = Effect.acquireRelease(
  Effect.promise(async () => {
    const name = `test_${randomUUID().replaceAll("-", "")}`;
    await admin(`create database ${name} template ${template}`);
    return name;
  }),
  (name) => Effect.promise(() => admin(`drop database ${name} with (force)`)),
).pipe(Effect.map(serverUrl));
