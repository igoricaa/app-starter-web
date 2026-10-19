import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { betterAuth } from "better-auth/minimal";
import { emailOTP } from "better-auth/plugins/email-otp";
import { tanstackStartCookies } from "better-auth/tanstack-start";
import { and, count, eq, gt, lt, sql } from "drizzle-orm";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Context, Effect, Layer, Option, Redacted, Schema } from "effect";
import { Pool } from "pg";
import { Resend } from "resend";
import * as z from "zod";
import { authConfig, databaseUrl } from "./config";
import { Unauthenticated } from "./errors";
import * as schema from "./schema";

// Created by `bun run seed`. While TEST_OTP_CODE is set they sign in with that code, never get
// mail, and skip the code limits, so repeated e2e runs on one preview don't throttle themselves.
export const seededAccounts = [{ email: "test@example.test", name: "Test User" }];

type AuthConfig = Effect.Success<typeof authConfig>;

// Checked before the endpoint runs, keyed by the address, so a refused request never stores or
// replaces a code (which would reset its attempts).
const limits = {
  send: { perAddress: 3, newAddressesPerHour: 100 },
  verify: { perAddress: 10 },
};
const limitedPaths: Record<string, keyof typeof limits> = {
  "/email-otp/send-verification-otp": "send",
  "/sign-in/email-otp": "verify",
};
// Better Auth's own check, on the lowercased address, so the global cap counts exactly the
// addresses it accepts.
const isValidEmail = (email: string) => z.email().safeParse(email.toLowerCase()).success;

function makeAuth(db: NodePgDatabase, config: AuthConfig) {
  const usesFixedCode = (email: string) =>
    Option.isSome(config.testOtpCode) &&
    seededAccounts.some((account) => account.email === email.trim().toLowerCase());

  return betterAuth({
    // Resolved per request from the Host header, so a wildcard SITE_URL covers every preview URL.
    baseURL: {
      allowedHosts: [config.siteUrl],
      protocol: config.siteUrl.startsWith("https:") ? "https" : "http",
    },
    secret: Redacted.value(config.secret),
    database: drizzleAdapter(db, { provider: "pg", schema }),
    // Serverless instances share no memory, so the per-IP limits are counted in the database.
    rateLimit: { storage: "database" },
    // Sign-in codes are the only codes used: no passwords, no email change, no email verification.
    // Users change their name through the app's own validated updateDisplayName.
    disabledPaths: [
      "/email-otp/request-password-reset",
      "/forget-password/email-otp",
      "/email-otp/reset-password",
      "/email-otp/request-email-change",
      "/email-otp/change-email",
      "/email-otp/check-verification-otp",
      "/email-otp/verify-email",
      "/update-user",
    ],
    hooks: {
      before: createAuthMiddleware(async (ctx) => {
        const kind = limitedPaths[ctx.path];
        const email: unknown = ctx.body?.email;
        if (!kind || typeof email !== "string" || usesFixedCode(email)) return;
        // Only a sign-in code to a valid address can create an account.
        const signUp = kind === "send" && ctx.body?.type === "sign-in" && isValidEmail(email);
        if (!(await allowAttempt(db, kind, email.toLowerCase(), signUp))) {
          throw new APIError("TOO_MANY_REQUESTS", {
            message: "Too many attempts. Wait a few minutes and try again.",
          });
        }
      }),
    },
    databaseHooks: {
      user: {
        create: {
          // Sign-up takes any `name` and `image` from the request. Keep the name only if it is a
          // valid display name; the app has no images.
          before: async (user) => ({
            data: {
              ...user,
              name: Schema.decodeUnknownOption(schema.DisplayName)(user.name).pipe(
                Option.getOrElse(() => user.email.split("@")[0]!.slice(0, 50)),
              ),
              image: null,
            },
          }),
        },
      },
    },
    plugins: [
      emailOTP({
        // Keyed by BETTER_AUTH_SECRET, which previews don't share, so a preview's copy of
        // production's codes is unusable. ("hashed" is unsalted SHA-256: six digits reverse at once.)
        storeOTP: "encrypted",
        // Returning undefined falls back to a random code; expiry and attempt limits apply either way.
        generateOTP: ({ email }) =>
          usesFixedCode(email) ? Option.getOrUndefined(config.testOtpCode) : undefined,
        // Better Auth logs a failure here and still answers success.
        sendVerificationOTP: async ({ email, otp }) => {
          if (usesFixedCode(email)) return;
          await sendOtpEmail(config, email, otp);
        },
      }),
      // Last: the server's own getSession refreshes the session cookie, and this sends it.
      tanstackStartCookies(),
    ],
  });
}

// Records the attempt and answers true, or answers false when a limit is reached. A `signUp` send
// to an address with no account also counts toward the global cap. One lock serializes the check
// and the insert, so concurrent requests can't overshoot.
function allowAttempt(
  db: NodePgDatabase,
  kind: keyof typeof limits,
  email: string,
  signUp: boolean,
) {
  const { otpAttempt, user } = schema;
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext('otp_attempt'))`);
    await tx.delete(otpAttempt).where(lt(otpAttempt.createdAt, sql`now() - interval '1 hour'`));
    const since = (interval: string) =>
      gt(otpAttempt.createdAt, sql`now() - ${interval}::interval`);
    const countWhere = async (...conditions: Parameters<typeof and>) =>
      (
        await tx
          .select({ n: count() })
          .from(otpAttempt)
          .where(and(...conditions))
      )[0]!.n;

    const perAddress = await countWhere(
      eq(otpAttempt.kind, kind),
      eq(otpAttempt.email, email),
      since("10 minutes"),
    );
    if (perAddress >= limits[kind].perAddress) return false;

    let newAddress = false;
    if (signUp) {
      const [existing] = await tx.select({ id: user.id }).from(user).where(eq(user.email, email));
      newAddress = !existing;
      if (
        newAddress &&
        (await countWhere(eq(otpAttempt.newAddress, true), since("1 hour"))) >=
          limits.send.newAddressesPerHour
      ) {
        return false;
      }
    }
    await tx.insert(otpAttempt).values({ kind, email, newAddress });
    return true;
  });
}

async function sendOtpEmail(config: AuthConfig, to: string, otp: string) {
  if (Option.isNone(config.resendApiKey) || Option.isNone(config.emailFrom)) {
    throw new Error("Sign-in code not sent: set RESEND_API_KEY and EMAIL_FROM.");
  }
  const resend = new Resend(Redacted.value(config.resendApiKey.value));
  const { error } = await resend.emails.send({
    from: config.emailFrom.value,
    to,
    subject: `Your sign-in code: ${otp}`,
    text: `Your sign-in code is ${otp}. It expires in 5 minutes.`,
  });
  if (error) throw new Error(`Resend refused the sign-in email: ${error.message}`);
}

export class Auth extends Context.Service<Auth, ReturnType<typeof makeAuth>>()("app/server/Auth") {}

export const layer = Layer.effect(
  Auth,
  Effect.gen(function* () {
    const url = yield* databaseUrl;
    const config = yield* authConfig;
    // Better Auth's adapter needs Promise-based Drizzle, so it gets its own node-postgres pool.
    const pool = yield* Effect.acquireRelease(
      Effect.sync(() => {
        const pool = new Pool({ connectionString: Redacted.value(url) });
        // An idle connection's error (a dropped connection) would otherwise crash the process.
        pool.on("error", (error) => console.error("Better Auth's database pool:", error.message));
        return pool;
      }),
      (pool) => Effect.promise(() => pool.end()),
    );
    return makeAuth(drizzle({ client: pool }), config);
  }),
);

export class CurrentUser extends Context.Service<CurrentUser, { readonly id: string }>()(
  "app/server/CurrentUser",
) {}

export const findSession = (headers: Headers) =>
  Auth.use((auth) => Effect.promise(() => auth.api.getSession({ headers })));

// The signed-in user comes from the session cookie in these request headers, never from input.
export const authenticate = (headers: Headers) =>
  Layer.effect(
    CurrentUser,
    Effect.gen(function* () {
      const session = yield* findSession(headers);
      if (!session) return yield* new Unauthenticated();
      return CurrentUser.of({ id: session.user.id });
    }),
  );

// Safe to re-run. Refuses where TEST_OTP_CODE is unset, which includes production.
export const seed = Effect.gen(function* () {
  const { testOtpCode } = yield* authConfig;
  if (Option.isNone(testOtpCode)) {
    return yield* Effect.die(new Error("The seed runs only where TEST_OTP_CODE is set."));
  }
  const { internalAdapter } = yield* Auth.use((auth) => Effect.promise(() => auth.$context));
  for (const account of seededAccounts) {
    if (yield* Effect.promise(() => internalAdapter.findUserByEmail(account.email))) continue;
    yield* Effect.promise(() =>
      internalAdapter.createUser({ ...account, emailVerified: true }, { method: "admin" }),
    );
  }
});
