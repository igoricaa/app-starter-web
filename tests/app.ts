import { ConfigProvider, Effect, Layer } from "effect";
import * as AccountService from "~/server/AccountService";
import * as Auth from "~/server/auth";
import * as Db from "~/server/Db";
import { testDatabase } from "./postgres";

const origin = "http://localhost:3000";

// The app's services and config on a fresh test database. `env` adds environment variables.
export const testApp = (env: Record<string, string> = {}) =>
  Layer.mergeAll(AccountService.layer, Auth.layer).pipe(
    Layer.provideMerge(Db.layer),
    Layer.provideMerge(
      ConfigProvider.layer(
        Effect.map(testDatabase, (url) =>
          ConfigProvider.fromUnknown({
            DATABASE_URL: url,
            SITE_URL: origin,
            BETTER_AUTH_SECRET: "test-only-secret-0123456789abcdef",
            ...env,
          }),
        ),
      ),
    ),
  );

// A browser's POST to Better Auth's handler, signed out or with `headers`' session.
export const postAuth = (path: string, body: object, headers?: Headers) =>
  Auth.Auth.use((auth) =>
    Effect.promise(() =>
      auth.handler(
        new Request(`${origin}/api/auth${path}`, {
          method: "POST",
          headers: {
            cookie: headers?.get("cookie") ?? "",
            "content-type": "application/json",
            origin,
          },
          body: JSON.stringify(body),
        }),
      ),
    ),
  );

// Issues a sign-in code through the real generation hook (no mail), then signs in over HTTP with
// `otp`, or with the issued code when `otp` is omitted. `signUp` adds fields to the request body.
export const signIn = (email: string, otp?: string, signUp: object = {}) =>
  Effect.gen(function* () {
    const issued = yield* Auth.Auth.use((auth) =>
      Effect.promise(() =>
        auth.api.createVerificationOTP({
          body: { email, type: "sign-in" },
          headers: { host: new URL(origin).host },
        }),
      ),
    );
    return yield* postAuth("/sign-in/email-otp", { ...signUp, email, otp: otp ?? issued });
  });

// The headers a browser sends after this sign-in response, or signed out without one.
export function sessionHeaders(response?: Response) {
  const cookie = (response?.headers.getSetCookie() ?? [])
    .map((header) => header.split(";")[0])
    .join("; ");
  return new Headers({ host: new URL(origin).host, cookie });
}
