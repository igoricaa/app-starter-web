import { assert, describe, it } from "@effect/vitest";
import { desc, eq } from "drizzle-orm";
import { Cause, Effect, Exit } from "effect";
import { postAuth, sessionHeaders, signIn, testApp } from "../../tests/app";
import { seed, seededAccounts } from "./auth";
import { Db } from "./Db";
import { otpAttempt, user, verification } from "./schema";

const FIXED_CODE = "424242";
const seeded = seededAccounts[0]!.email;

const sendCode = (email: string, type = "sign-in") =>
  Effect.map(postAuth("/email-otp/send-verification-otp", { email, type }), (r) => r.status);
const guess = (email: string, otp: string) =>
  Effect.map(postAuth("/sign-in/email-otp", { email, otp }), (r) => r.status);
// The stored `code:attempts` value.
const storedCode = (email: string) =>
  Effect.gen(function* () {
    const db = yield* Db;
    const [row] = yield* db
      .select({ value: verification.value })
      .from(verification)
      .where(eq(verification.identifier, `sign-in-otp-${email}`))
      .orderBy(desc(verification.createdAt))
      .limit(1)
      .pipe(Effect.orDie);
    return row?.value;
  });
const userRow = (email: string) =>
  Effect.gen(function* () {
    const db = yield* Db;
    const [row] = yield* db.select().from(user).where(eq(user.email, email));
    return row;
  }).pipe(Effect.orDie);
const nameOf = (email: string) => Effect.map(userRow(email), (row) => row?.name);

describe("fixed OTP", () => {
  it.effect("signs in a seeded account when TEST_OTP_CODE is set; the seed re-runs safely", () =>
    Effect.gen(function* () {
      yield* seed;
      yield* seed;
      const response = yield* signIn(seeded.toUpperCase(), FIXED_CODE);
      assert.strictEqual(response.status, 200);
    }).pipe(Effect.provide(testApp({ TEST_OTP_CODE: FIXED_CODE }))),
  );

  it.effect("is refused without TEST_OTP_CODE, where the seed also refuses", () =>
    Effect.gen(function* () {
      const refusal = yield* Effect.exit(seed);
      assert.isTrue(Exit.isFailure(refusal) && /TEST_OTP_CODE/.test(Cause.pretty(refusal.cause)));
      const response = yield* signIn(seeded, FIXED_CODE);
      assert.strictEqual(response.status, 400);
    }).pipe(Effect.provide(testApp())),
  );

  it.effect("is refused for an unseeded address", () =>
    Effect.gen(function* () {
      const response = yield* signIn("someone@example.test", FIXED_CODE);
      assert.strictEqual(response.status, 400);
    }).pipe(Effect.provide(testApp({ TEST_OTP_CODE: FIXED_CODE }))),
  );
});

describe("code limits", () => {
  it.effect("a throttled request stores no new code, so guessing can't continue", () =>
    Effect.gen(function* () {
      const victim = "victim@example.test";
      for (let i = 0; i < 3; i++) assert.strictEqual(yield* sendCode(victim), 200);
      const code = (yield* storedCode(victim))!.split(":")[0]!;
      for (let i = 0; i < 3; i++) assert.strictEqual(yield* guess(victim, "000000"), 400);
      const spent = yield* storedCode(victim);
      assert.strictEqual(spent, `${code}:3`);

      assert.strictEqual(yield* sendCode(victim.toUpperCase()), 429);
      assert.strictEqual(yield* storedCode(victim), spent);
      assert.strictEqual(yield* guess(victim, code), 403);
    }).pipe(Effect.provide(testApp())),
  );

  it.effect("checks are limited per address, even with the right code", () =>
    Effect.gen(function* () {
      const target = "target@example.test";
      for (let i = 0; i < 10; i++) assert.strictEqual(yield* guess(target, "000000"), 400);
      const response = yield* signIn(target);
      assert.strictEqual(response.status, 429);
    }).pipe(Effect.provide(testApp())),
  );

  it.effect("only new addresses count toward the global cap", () =>
    Effect.gen(function* () {
      const existing = "existing@example.test";
      assert.strictEqual((yield* signIn(existing)).status, 200);
      const db = yield* Db;
      yield* db
        .insert(otpAttempt)
        .values(
          Array.from({ length: 100 }, (_, i) => ({
            kind: "send" as const,
            email: `new${i}@example.test`,
            newAddress: true,
          })),
        )
        .pipe(Effect.orDie);

      assert.strictEqual(yield* sendCode("one-more@example.test"), 429);
      assert.strictEqual(yield* sendCode(existing), 200);
    }).pipe(Effect.provide(testApp())),
  );

  it.effect("invalid sends don't use up the global cap", () =>
    Effect.gen(function* () {
      const db = yield* Db;
      yield* db
        .insert(otpAttempt)
        .values(
          Array.from({ length: 99 }, (_, i) => ({
            kind: "send" as const,
            email: `new${i}@example.test`,
            newAddress: true,
          })),
        )
        .pipe(Effect.orDie);

      assert.strictEqual(yield* sendCode("not-an-email"), 400);
      assert.strictEqual(yield* sendCode("unknown@example.test", "email-verification"), 200);
      assert.strictEqual(yield* sendCode("last@example.test"), 200);
      assert.strictEqual(yield* sendCode("one-more@example.test"), 429);
    }).pipe(Effect.provide(testApp())),
  );
});

describe("sign-up", () => {
  it.effect("keeps a valid name, replaces an unbounded one, and stores no image", () =>
    Effect.gen(function* () {
      yield* signIn("dana@example.test", undefined, { name: "  Dana  " });
      yield* signIn("huge@example.test", undefined, {
        name: "x".repeat(100_000),
        image: `data:image/png;base64,${"A".repeat(1_000_000)}`,
      });
      yield* signIn("nameless@example.test");
      assert.strictEqual(yield* nameOf("dana@example.test"), "Dana");
      assert.strictEqual(yield* nameOf("huge@example.test"), "huge");
      assert.isNull((yield* userRow("huge@example.test"))?.image);
      assert.strictEqual(yield* nameOf("nameless@example.test"), "nameless");
    }).pipe(Effect.provide(testApp())),
  );
});

describe("Better Auth's own endpoints", () => {
  it.effect("refuse a signed-in user's update-user and the unused code checks", () =>
    Effect.gen(function* () {
      const email = "erin@example.test";
      const headers = sessionHeaders(yield* signIn(email, undefined, { name: "Erin" }));
      const update = yield* postAuth("/update-user", { name: "", image: "x" }, headers);
      assert.strictEqual(update.status, 404);
      assert.deepInclude(yield* userRow(email), { name: "Erin", image: null });
      for (const path of ["/email-otp/check-verification-otp", "/email-otp/verify-email"]) {
        const response = yield* postAuth(path, { email, type: "sign-in", otp: "000000" });
        assert.strictEqual(response.status, 404, path);
      }
    }).pipe(Effect.provide(testApp())),
  );
});
