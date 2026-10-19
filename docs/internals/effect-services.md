# Effect services

The account page is the reference slice. New features copy its shape:

- `src/functions/account.ts`: `createServerFn`, its input decoded with Effect Schema, one service call through `runAuthed`.
- `src/server/AccountService.ts`: a `Context.Service` and its `layer`. Methods read `CurrentUser`; an id argument names a record, never the caller.
- `src/server/AccountService.test.ts`: a signed-out caller is refused, a second user passing the first one's id gets `NotFound` and changes nothing, an invalid input returns its code.
- `src/routes/_authed/account.tsx`: a loader with `ensureQueryData`, the error code shown on its field.

A method that takes a record's id loads the record, then refuses unless the caller owns it. Someone else's record and a missing one both answer `NotFound`, so ids reveal nothing:

```ts
const rename = Effect.fn("NoteService.rename")(function* (id: string, title: string) {
  const me = yield* CurrentUser;
  const [note] = yield* db.select().from(notes).where(eq(notes.id, id)).pipe(Effect.orDie);
  if (!note || note.ownerId !== me.id) return yield* new NotFound();
  yield* db.update(notes).set({ title }).where(eq(notes.id, note.id)).pipe(Effect.orDie);
});
```

The pattern is t3code's (`docs/internals/effect-services.md` and `infra/relay/src/db.ts` there).

## Rules lint and types don't cover

- **Server functions** decode, make one service call, and nothing else. Logic lives in services, so tests, scripts and future transports reach it too.
- **Running Effects.** `src/server/runtime.ts` holds the one `ManagedRuntime`; `run` and `runAuthed` are the only way in. Scripts (`scripts/seed.ts`) are their own entry points.
- **Errors.** A failure the user may see is a `Schema.TaggedError` in `src/server/errors.ts`, listed in `AppFailure`: its tag is the code, its message is shown. Anything else (database errors via `Effect.orDie`, defects) is logged and the browser gets a generic message. The UI reads errors with `readError` from `src/lib/app-error.ts`.
- **Identity.** `CurrentUser` comes from the Better Auth session in the request (`authenticate` in `src/server/auth.ts`), never from input.
- **Database.** `Db` is Drizzle on `@effect/sql-pg`: a query is an Effect. Use `Transactions.withTransaction` when writes must land together. Better Auth keeps its own Promise-based client.
- **Schema changes.** Edit `src/server/schema.ts`, run `bun run db:generate`, commit `drizzle/`. Vercel's build migrates; a preview refuses to touch production's database.
- **Environment.** Read server variables through Effect `Config` in `src/server/config.ts`; browser values are `VITE_` variables via `import.meta.env`.
- **Auth.** `src/server/auth.ts` holds Better Auth (email OTP only) and the fixed test code for seeded accounts. Its code limits run in a before-hook, keyed by address, so a refused request never stores or replaces a code: 3 codes per address per 10 minutes, 10 code checks per address per 10 minutes, and 100 codes per hour for addresses with no account yet. Its base URL comes from the request's host, allowed by `SITE_URL`; previews set it to a wildcard.
- **Tests** use `@effect/vitest` on real PostgreSQL: `tests/app.ts` gives the app's layers on a fresh copy of the migrated template, and `signIn` signs in through Better Auth.
- **`bun run dev` deletes `src/routeTree.gen.ts` first.** With nitro `3.0.260903-beta`, `vite dev` started over an existing route tree answers every page with a 500 (`transport invoke timed out` in nitro's dev worker). Remove the `rm` once a nitro release starts cleanly with the file present.
