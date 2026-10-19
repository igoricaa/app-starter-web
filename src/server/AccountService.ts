import { eq } from "drizzle-orm";
import { Context, Effect, Layer, Schema } from "effect";
import { CurrentUser } from "./auth";
import * as Db from "./Db";
import { InvalidDisplayName, NotFound } from "./errors";
import { DisplayName, user } from "./schema";

// The reference slice. Identity comes from CurrentUser; an id from the caller only names a record,
// which is loaded and refused unless the caller owns it.
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
      const [account] = yield* db
        .select({ id: user.id })
        .from(user)
        .where(eq(user.id, id))
        .pipe(Effect.orDie);
      // An account's owner is the account itself. Other records compare their owner column.
      if (!account || account.id !== me.id) return yield* new NotFound();
      yield* db
        .update(user)
        .set({ name: displayName })
        .where(eq(user.id, account.id))
        .pipe(Effect.orDie);
    });

    return AccountService.of({ getMine, updateDisplayName });
  }),
);
