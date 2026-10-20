# app-starter-web

app-kit's starter for custom web apps: TanStack Start on Vercel, Effect services on Neon Postgres with Drizzle, Better Auth with email codes, and shadcn/ui on Base UI.

New apps are created from this template with `/app-setup new <name> web`, the user-level skill in [igoricaa/app-kit](https://github.com/igoricaa/app-kit). It also wires the app's services.

## Inside

- The account page as the reference slice: `src/server/AccountService.ts`, its tests on real PostgreSQL, and `src/routes/_authed/account.tsx`.
- Sign-in with email codes, a seeded test account, and one Playwright test of the flow.
- CI: `verify` on every PR and on `main`; `e2e` against each Vercel preview, which has its own Neon database branch.
- `scripts/vercel-build.sh`, the only path to production: merging to `main`. A push that changes only docs skips the production build.
- The kit's agent files: `AGENTS.md`, the skills in `.agents/skills/`, `docs/agents/` and `.coderabbit.yaml`.

## Links

- [`AGENTS.md`](AGENTS.md): how to work here. Read it first.
- [`docs/internals/effect-services.md`](docs/internals/effect-services.md): Effect, database and auth rules.
- Live: https://app-starter-web.vercel.app
