import { assert, layer } from "@effect/vitest";
import { Effect } from "effect";
import { sessionHeaders, signIn, testApp } from "../../tests/app";
import { AccountService } from "./AccountService";
import { authenticate } from "./auth";

const signedIn = (email: string) => Effect.map(signIn(email), sessionHeaders);
const getMine = AccountService.use((account) => account.getMine);
const update = (id: string, displayName: string) =>
  AccountService.use((account) => account.updateDisplayName(id, displayName));

layer(testApp())("AccountService", (it) => {
  it.effect("refuses a signed-out caller", () =>
    Effect.gen(function* () {
      const signedOut = authenticate(sessionHeaders());
      const read = yield* getMine.pipe(Effect.provide(signedOut), Effect.flip);
      const write = yield* update("any", "Mallory").pipe(Effect.provide(signedOut), Effect.flip);
      assert.strictEqual(read._tag, "Unauthenticated");
      assert.strictEqual(write._tag, "Unauthenticated");
    }),
  );

  it.effect("user B passing user A's id gets NotFound, and A's account is unchanged", () =>
    Effect.gen(function* () {
      const alice = authenticate(yield* signedIn("alice@example.test"));
      const bob = authenticate(yield* signedIn("bob@example.test"));
      const aliceId = (yield* getMine.pipe(Effect.provide(alice))).id;
      yield* update(aliceId, "Alice").pipe(Effect.provide(alice));

      const error = yield* update(aliceId, "Mallory").pipe(Effect.provide(bob), Effect.flip);

      assert.strictEqual(error._tag, "NotFound");
      assert.deepStrictEqual(yield* getMine.pipe(Effect.provide(alice)), {
        id: aliceId,
        email: "alice@example.test",
        displayName: "Alice",
      });
    }),
  );

  it.effect("an invalid name returns its code and changes nothing", () =>
    Effect.gen(function* () {
      const carol = authenticate(yield* signedIn("carol@example.test"));
      const { id } = yield* getMine.pipe(Effect.provide(carol));
      yield* update(id, "Carol").pipe(Effect.provide(carol));

      for (const displayName of ["   ", "x".repeat(51)]) {
        const error = yield* update(id, displayName).pipe(Effect.provide(carol), Effect.flip);
        assert.strictEqual(error._tag, "InvalidDisplayName");
      }
      assert.strictEqual((yield* getMine.pipe(Effect.provide(carol))).displayName, "Carol");
    }),
  );
});
