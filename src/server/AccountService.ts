import { and, eq } from "drizzle-orm";
import { Context, Effect, Layer, Schema } from "effect";
import { CurrentUser } from "./auth";
import * as Db from "./Db";
import { InvalidDisplayName, NotFound } from "./errors";
import { DisplayName, user } from "./schema";

// The reference slice. Identity comes from CurrentUser; an id from the caller only names a record.
// A write names the record and its owner in one statement; no row back means NotFound.
export class AccountService extends Context.Service<
  AccountService,
  {
    readonly getMine: Effect.Effect<
      { readonly id: string; readonly email: string; readonly displayName: string },
      never,
      CurrentUser
    >;
    readonly updateDisplayName: (
      id: string,
      displayName: string,
    ) => Effect.Effect<void, InvalidDisplayName | NotFound, CurrentUser>;
  }
>()("app/server/AccountService") {}

export const layer = Layer.effect(
  AccountService,
  Effect.gen(function* () {
    const db = yield* Db.Db;

    const getMine = Effect.gen(function* () {
      const me = yield* CurrentUser;
      const [account] = yield* db
        .select({ id: user.id, email: user.email, displayName: user.name })
        .from(user)
        .where(eq(user.id, me.id))
        .pipe(Effect.orDie);
      if (!account) return yield* Effect.die(new Error("The signed-in user has no row."));
      return account;
    }).pipe(Effect.withSpan("AccountService.getMine"));

    const updateDisplayName = Effect.fn("AccountService.updateDisplayName")(function* (
      id: string,
      input: string,
    ) {
      const displayName = yield* Schema.decodeUnknownEffect(DisplayName)(input).pipe(
        Effect.mapError(() => new InvalidDisplayName()),
      );
      const me = yield* CurrentUser;
      // An account's owner is the account itself; other records compare their owner column.
      const [updated] = yield* db
        .update(user)
        .set({ name: displayName })
        .where(and(eq(user.id, id), eq(user.id, me.id)))
        .returning({ id: user.id })
        .pipe(Effect.orDie);
      if (!updated) return yield* new NotFound();
    });

    return AccountService.of({ getMine, updateDisplayName });
  }),
);
