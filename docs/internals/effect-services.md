# Effect services

The account page is the reference slice. New features copy its shape:

- `src/functions/account.ts`: `createServerFn`, its input decoded with `.validator(input(Schema))`, ids included, one service call through `runAuthed`.
- `src/server/AccountService.ts`: a `Context.Service` and its `layer`. Methods read `CurrentUser`; an id argument names a record, never the caller.
- `src/server/AccountService.test.ts`: a signed-out caller is refused, a second user passing the first one's id gets `NotFound` and changes nothing, an invalid input returns its code.
- `src/routes/_authed/account.tsx`: a loader with `ensureQueryData`, the error code shown on its field.

A method that takes a record's id names the record and its owner in the one statement that writes it, so no other request can slip in between a check and the write. No row back answers `NotFound`, for someone else's record and a missing one alike, so ids reveal nothing:

```ts
const rename = Effect.fn("NoteService.rename")(function* (id: string, title: string) {
  const me = yield* CurrentUser;
  const [note] = yield* db
    .update(notes)
    .set({ title })
    .where(and(eq(notes.id, id), eq(notes.ownerId, me.id)))
    .returning({ id: notes.id })
    .pipe(Effect.orDie);
  if (!note) return yield* new NotFound();
});
```

The server function's input schema decodes the id's format (`Schema.String.check(Schema.isUUID())` for a uuid column), so a malformed id is `InvalidInput`, never a database error.

## Rules lint and types don't cover

- **Server functions** decode, make one service call, and nothing else. Logic lives in services, so tests, scripts and future transports reach it too.
- **Running Effects.** `src/server/runtime.ts` holds the one `ManagedRuntime`; `run` and `runAuthed` are the only way in. Scripts (`scripts/seed.ts`) are their own entry points.
- **Errors.** A failure the user may see is a `Schema.TaggedError` in `src/server/errors.ts`, listed in `AppFailure`: its tag is the code, its message is shown. Input that fails a server function's schema is `InvalidInput` (`input` in `src/server/runtime.ts`). Anything else (database errors via `Effect.orDie`, defects) is logged and the browser gets a generic message. The UI reads errors with `readError` from `src/lib/app-error.ts`.
- **Identity.** `CurrentUser` comes from the Better Auth session in the request (`authenticate` in `src/server/auth.ts`), never from input.
- **Database.** `Db` is Drizzle on `@effect/sql-pg`: a query is an Effect. Use `db.transaction((tx) => …)` when writes must land together. Better Auth keeps its own Promise-based client.
- **Schema changes.** Edit `src/server/schema.ts`, run `bun run db:generate`, commit `drizzle/`. Vercel's build migrates over `DATABASE_URL_UNPOOLED` (a pooled host would drop the migration lock); `scripts/guard.ts` first refuses a preview unless both URLs are plain Neon URLs (an allowlist: Neon also routes by an `endpoint=` in the password or `options`) whose endpoint isn't production's.
- **Previews copy production's data.** Vercel-managed Neon branches every preview from the default branch, with no setting to branch from `dev`. So previews never get `RESEND_API_KEY` (the guard refuses it) and sign in only as the seeded accounts, and sign-in codes are stored encrypted with `BETTER_AUTH_SECRET`, which previews must not share with production. When a change could be a rename, drizzle-kit asks; without a terminal it exits with code 2 and prints the `--hints` JSON to re-run with.
- **Environment.** Read server variables through Effect `Config` in `src/server/config.ts`; browser values are `VITE_` variables via `import.meta.env`.
- **Auth.** `src/server/auth.ts` holds Better Auth (email OTP only) and the fixed test code for seeded accounts. Its endpoints that change a user (`/update-user`) or use other codes are disabled; account changes go through services. `tanstackStartCookies()` stays the last plugin: without it the session refresh from the server's own `getSession` never reaches the browser, and everyone is signed out a week after signing in. Its code limits run in a before-hook, keyed by address, so a refused request never stores or replaces a code: 3 codes per address per 10 minutes, 10 code checks per address per 10 minutes, and 100 sign-in codes per hour for valid addresses with no account yet. Its base URL comes from the request's host, allowed by `SITE_URL`; previews set it to a wildcard.
- **Tests** use `@effect/vitest` on real PostgreSQL: `tests/app.ts` gives the app's layers on a fresh copy of the migrated template, and `signIn` signs in through Better Auth.
- **`bun run dev` deletes `src/routeTree.gen.ts` first.** With nitro `3.0.260903-beta`, `vite dev` started over an existing route tree answers every page with a 500 (`transport invoke timed out` in nitro's dev worker). Remove the `rm` once a nitro release starts cleanly with the file present.
