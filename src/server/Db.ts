import * as PgClient from "@effect/sql-pg/PgClient";
import * as PgDrizzle from "drizzle-orm/effect-postgres";
import { Context, Layer } from "effect";
import { databaseUrl } from "./config";

// Drizzle on @effect/sql-pg: a query is an Effect, `yield* db.select().from(user)`. Writes that
// must land together go in `db.transaction((tx) => …)`.
export class Db extends Context.Service<Db, PgDrizzle.EffectPgDatabase>()("app/server/Db") {}

export const layer = Layer.effect(Db, PgDrizzle.makeWithDefaults()).pipe(
  Layer.provide(PgClient.layerConfig({ url: databaseUrl })),
);
