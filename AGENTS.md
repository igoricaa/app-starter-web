# App Starter (web)

The app-kit starter for custom web apps: TanStack Start on Vercel, Effect services on Neon Postgres with Drizzle, and Better Auth with email codes. Shape replaces this paragraph with what the app is, who uses it, and what makes it special.

## A note from Igor

I like simple systems and software that feels obvious. Don't preserve complexity because it already exists, and don't add machinery because it looks impressive. Understand the real constraint, then build the smallest thing that makes the correct behaviour unsurprising.

Measure twice, cut once, and YAGNI. Fight scope creep.

Treat this file as good defaults, not hard rules. If a rule fights the task in front of you, say so and ask before breaking it.

## The ways to hurt yourself

1. **Touching production.**
   - Never run a migration or a script against production's database, `vercel --prod`, or `vercel env pull` for production.
   - Production changes only by merging to `main`; Vercel's build migrates and deploys it (`scripts/vercel-build.sh`).
   - Never read, print or copy a production URL or key.
2. **Printing secrets.** Never echo, log or commit one. Generate a secret and pipe it straight in: `openssl rand -base64 32 | vercel env add BETTER_AUTH_SECRET preview`.
3. **Breaking open tabs.** Users keep the old frontend open after a deploy, so a server function's input and return value change only additively. Removals and renames go in a later PR.
4. **Narrowing data in one step.** It takes three PRs: widen the schema, backfill, then narrow, and only after the backfill has completed. Igor takes a backup first.
5. **Editing an applied migration.** Change `src/server/schema.ts`, run `bun run db:generate`, and commit the new folder in `drizzle/`.
6. **Using dev from a worktree.** Worktrees share the Neon `dev` branch through `.env.local`. Builders never migrate it or run the dev server; they test with `bun run test`, which starts its own PostgreSQL. Nothing migrates `dev` for an unmerged migration; `/build`'s browser walk runs on the PR's preview.

## Hit every surface

The most common defect is a change that works on the path you tested and is missing everywhere else. Before calling work done, walk this list and say which entries applied:

- **Entry points:** every route, nav item and link that reaches the feature.
- **Roles and tenants:** who may see or do it, and what everyone else sees.
- **Reverse states:** a way in needs a way out and a way to see it.
- **Loading, empty and error states,** at 1440 and 390.
- **Email:** any message the change sends or should send.
- **Seed data:** a new kind of record needs seed rows, so previews show it.
- **Docs:** whether the change makes existing guidance wrong.

## Dev servers

- `bun run setup` installs dependencies and checks out Effect's source in `.repos/effect`. New worktrees run it from `t3.json`, and get `.env.local` and `.repos` linked from the main checkout.
- `bun run dev` runs Vite on port 3000, against the Neon `dev` branch in `.env.local`. Only Igor runs it. It deletes `src/routeTree.gen.ts` first, to work around a nitro beta bug (see `docs/internals/effect-services.md`).
- Stop what you started, by the PID you captured. Never kill by name or pattern.

## Test data

- `bun run seed` creates the seeded accounts (see `src/server/auth.ts`). It refuses wherever `TEST_OTP_CODE` is unset, which includes production.
- Sign in as a seeded account with the code in `TEST_OTP_CODE`. It works only in dev and previews, and only for seeded addresses. Previews get the same value as dev, so the one in `.env.local` works on both. Use it without printing it: `TEST_OTP_CODE="$(sed -n 's/^TEST_OTP_CODE=//p' .env.local)" bunx playwright …`.
- Each branch's previews share one Neon database branch, migrated and seeded on every deploy.

## Verifying

- **Smallest proof:** format the files you touched with `bunx oxfmt <files>`; run the tests that cover the change, plus type-aware lint (`bunx oxlint --type-aware <files>`) and typecheck (`bunx tsc --noEmit`). CI runs the full suite.
- **Tests need PostgreSQL 18**, Neon's version (`brew install postgresql@18`). They start a throwaway cluster, and each test layer gets a fresh copy of the migrated database.
- **Backend changes** ship with focused tests at the service boundary: who may call it, whose data it touches, and the error codes. Copy `src/server/AccountService.test.ts`.
- **Test meaningful behaviour.** No static-render tests, no tests that mirror the implementation, no snapshots.
- **End-to-end:** one Playwright test (sign-in). Add one only for a flow whose breaking would really hurt.
- **Browsers:** the browser walk runs on the preview (see `/build`); otherwise only when Igor asks.

## Pull requests

- Conventional commit titles in plain language, with the Linear key: `feat(account): edit display name (APP-12)`.
- The body follows `/build`.
- Merging deploys production. CI green means verify, the Vercel build and the preview e2e for the head SHA; confirm e2e itself passed (`gh pr checks <n> --json name,bucket --jq '.[] | select(.name == "e2e") | .bucket'` prints `pass`).

## Documentation

Most changes need no doc change. Agents can read the code.
- **`docs/internals/`** is for constraints that span files and traps that are hard to see in the source. Before adding a paragraph, ask what a maintainer would get wrong without it.
- **Rewrite or delete** text that a change makes untrue. Never append a second account.
- **`GLOSSARY.md`** holds terms only.
- **`docs/adr/`** is for decisions that are hard to reverse, surprising, and a real trade-off.
- **`docs/decisions.md`** holds product rules in force, one line each, added only on Igor's yes.

## Plans and work artifacts

- Never commit plans, research notes, reports, handovers or scratch files.
- Specs and tickets live in Linear (`docs/agents/issue-tracker.md`). A merged PR is the implementation record.
- Research is saved only when Igor says so.

## How it works

- **Data:** routes load data on the server with `ensureQueryData`, calling server functions (`src/functions/`) through TanStack Query. A server function runs one Effect service call; services query Postgres with Drizzle.
- **Auth:** Better Auth runs inside the app at `/api/auth/*`, with its own connection pool.
  - The root route reads the session on the server, so signed-in pages render with data.
  - `_authed` redirects signed-out visitors on the server.
- **Database:** Neon, through Vercel's Neon integration. The app uses the pooled `DATABASE_URL`; migrations use the direct `DATABASE_URL_UNPOOLED`.
- **Deploys:** Vercel runs `scripts/vercel-build.sh` on every deploy.
  - A push to `main` that changes only `*.md`, `docs/`, `.agents/` or `.claude/` skips the production build (`ignoreCommand` in `vercel.json`). Previews always build.
  - It refuses a production build from any branch but `main`, `TEST_OTP_CODE` in production, and a preview whose database is production's or that has `RESEND_API_KEY` (`scripts/guard.ts`).
  - It migrates under an advisory lock, so concurrent deploys apply migrations one at a time; previews are then seeded; then it builds.
  - A preview gets its branch's own Neon database branch, deleted when its PR closes (`.github/workflows/cleanup.yml`). Production uses the main one.

## Where code lives

- `src/server/`: the backend.
  - Read `.repos/effect/LLMS.md` and `docs/internals/effect-services.md` before writing Effect code.
  - `src/server/runtime.ts` holds the only runtime; `run` and `runAuthed` are the only way in.
  - `src/server/schema.ts` is the database schema; `drizzle/` holds the generated migrations.
- `src/functions/`: server functions, one service call each.
- **The reference slice:** `src/server/AccountService.ts`, its test, `src/functions/account.ts` and `src/routes/_authed/account.tsx`. Copy its shape for new features.
- `src/routes/`: pages (file routes); `_authed/` needs a session.
- `src/components/ui/`: shadcn components (Base UI). They own their look.
- `src/lib/`: the auth client and the browser side of errors.
- `scripts/`: the Vercel build, migrations, seed and setup.
- `tests/`: the test database and app layers; `tests/e2e/` holds the one Playwright test.

## Taste

- **Every server function** decodes its input with Effect Schema and makes one service call through `run` or `runAuthed`. Logic lives in services.
- **Errors the user may see** are `Schema.TaggedError`s in `src/server/errors.ts`. Anything else is a defect: logged, never shown.
- **Identity** comes from `CurrentUser`, never from input.
- **Ownership and tenancy:** one `update … where id and owner … returning` statement checks the record and its owner together; no row back answers `NotFound`, for another user's record and a missing one alike. See `docs/internals/effect-services.md`.
- **External services:** an Effect service, provided in `src/server/runtime.ts`.
- **Validation** uses Effect Schema. No Zod unless a dependency forces it.
- UI components own their look. Pick a `variant` or `size`; never restyle one with `className`. Layout goes on a wrapping element. `@shadcn/lint` enforces it. See `docs/internals/web-ui.md` once the UI foundation writes it.
- Inferred types over annotations. `any` is the enemy.
- **Comments** describe how a thing is used, mostly on functions. Never narrate lines. A lint or type suppression carries its reason.

<!-- app-kit:start (kit-owned; refresh replaces this block) -->
## Sessions

Igor starts every session, and each one ends by naming the next command.
- **Setup:** `/app-setup`.
- **Shape,** one unbroken session:
  1. `/grill-with-docs`. Terms go in `GLOSSARY.md`; an ADR only when a decision is hard to reverse, surprising and a real trade-off.
  2. **One screen for Igor to approve:** the technical approach and the spec outline (data model sketch, key libraries, departures from the kit's defaults, scope in and out, main flows, key decisions, risky parts, test seams), and a `Design:` line: Paper first, or straight to code.
  3. `/to-spec`, written into a Linear parent issue. Its seam check is answered "as outlined".
  4. **The spec challenge,** by stakes (see Routing). Its findings update the spec.
  5. A one-screen overview: what the challenge changed, and any questions.
  6. **Paper first:** stop here. Igor runs `/design`, then `/to-tickets <spec>`, because screen tickets name their frames.
  7. `/to-tickets`.
  8. Before `/build`, commit `GLOSSARY.md`, ADRs and `docs/decisions.md` straight to `main` (docs only), so builders' worktrees see them.
- **Build:** `/build`, a fresh session per batch. Merging deploys production.
- **A small, clear feature** (one piece, no new data model, not high-stakes) skips Shape: `/build <what>`. The coordinator writes one Linear ticket (acceptance criteria, test seam) and builds it. Everything else goes through Shape and both its approval rounds (the outline, then the spec and tickets).
- **Tiny tweaks** (copy, spacing, a label) go straight to `main`, with no PR and no review.

## Routing

Every dispatch pins its model and effort. Never Haiku. At most 6 Opus agents at high or xhigh at once, and 10 agents in total, nested included. Codex models (Sol, Astra) run through T3 `delegate_task`. If T3 is unreachable, stop and say so; never swap a model silently.

| Work | Model | Effort |
|---|---|---|
| Discovery and spec session | Opus 5.5 | xhigh |
| Spec challenge: new app or high-stakes / other specs / small features | Astra + Opus 5.5 / Astra / none | xhigh |
| Build coordinator (`/build`) | Opus 5.5 | high |
| Backend builder (and pieces with both backend and UI) | Opus 5.5 | medium; high for really complex work |
| Design session (`/design`), UI foundation | Opus 5.5 | high |
| Screens and views | Sonnet 5.5 | medium |
| Ordinary review | Sol | high |
| Important review: changed or removed arguments or returns of existing functions, APIs other apps consume, substantial behaviour, integrations | Sol | xhigh |
| High-stakes review: money, authorization and tenancy, migrations and deletion, concurrency, billing webhooks | Sol + Opus 5.5 | xhigh |
| UI review in the browser, once per batch | Opus 5.5 | high |
| Research | Sol | medium |
| Hard debugging | Sol (diagnose) → Opus 5.5 (fix) | xhigh → high |

Consequence decides the review tier, never size or a "UI" label. A one-line permission change is high-stakes.
<!-- app-kit:end -->

## Agent skills

### Issue tracker

Linear (MCP `<server>`), team `TEAM_KEY`, project `PROJECT_NAME`. See `docs/agents/issue-tracker.md`.

### Domain docs

Single-context. See `docs/agents/domain.md`.
