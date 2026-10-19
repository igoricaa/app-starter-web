import * as PgClient from "@effect/sql-pg/PgClient";
import * as PgDrizzle from "drizzle-orm/effect-postgres";
import { Context, Layer } from "effect";
import { databaseUrl } from "./config";

// Drizzle on @effect/sql-pg: a query is an Effect, `yield* db.select().from(user)`.
export class Db extends Context.Service<
  Db,
  PgDrizzle.EffectPgDatabase & { readonly $client: PgClient.PgClient }
>()("app/server/Db") {}

// Every query inside `withTransaction(effect)` runs in one transaction.
export class Transactions extends Context.Service<
  Transactions,
  { readonly withTransaction: Db["Service"]["$client"]["withTransaction"] }
>()("app/server/Transactions") {}

export const layer = Layer.effect(
  Transactions,
  Db.useSync((db) => Transactions.of({ withTransaction: db.$client.withTransaction })),
).pipe(
  Layer.provideMerge(Layer.effect(Db, PgDrizzle.makeWithDefaults())),
  Layer.provide(PgClient.layerConfig({ url: databaseUrl })),
);
