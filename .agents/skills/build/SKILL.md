---
name: build
description: The build loop. Group tickets into pieces, run builders in worktrees, review before commit, open PRs and merge, which deploys production. Use when the owner types /build with Linear tickets, a milestone, or a described change.
disable-model-invocation: true
---

# Build

You are the coordinator: Opus 5.5 at high, in Claude Code inside T3 Code, because Sol and Astra reviews need T3's `delegate_task`. You route work, triage findings, commit, open PRs and merge. You write code yourself only for tiny tweaks.

`AGENTS.md` has the routing table, the ways to hurt yourself and the verification rules. Read it first. Linear operations are in `docs/agents/issue-tracker.md`.

## 0. Reconcile

After a crash, first resume the transcript. In a fresh session, read what is already there:
- worktrees (`git worktree list`) and their state;
- the tickets' Linear states;
- open PRs (`gh pr list`);
- live child tasks.

Committed pieces are done. Uncommitted pieces get a fresh review.

## 1. Group

- First update `main`: `git switch main && git pull --ff-only`.
- Turn the tickets into **pieces**: coherent work for one builder, covering one or more tickets.
- Group the pieces into **PR batches**.
- **High-stakes work** (money, authorization and tenancy, migrations and deletion, concurrency, billing webhooks) gets its own PR.
- **So does every data change:** a backfill, a migration, narrowing, a delete, or changing what an existing field means. Adding an optional field isn't a data change.
- Never make a huge PR.
- **The UI foundation comes first.** If the app has no `docs/internals/web-ui.md` and the work includes screens, the first batch is the UI foundation (Opus high), as `/design` defines it. Screens never start before it.
- Show the owner the grouping in a few lines, then start; don't wait for approval unless something is ambiguous.
- Move tickets to In Progress when work starts.

## 2. Build

- **Worktrees.** You create one per piece:
  1. `git worktree add ../<app>-wt/<slug> -b <type>/<slug> main`, with `<type>` one of `feat`, `fix` or `chore`;
  2. run the repo's own worktree setup there: the command in `t3.json`. It brings in `.env.local` (and `.repos`) and the dependencies.
- **Dispatch.** One builder per piece. Give it the worktree path, and the model and effort from the routing table. Pin both on every dispatch.
  - Claude builders: the Agent tool, working in that path.
  - Codex models: T3 `delegate_task`, told the path.
  - A piece with both backend and UI goes to the backend builder, unless it's mostly screens.
- **Parallel or serial.** Builders run in parallel only when they share no files or resources. Pieces that touch the schema file run one after another.
- **Dependent pieces.** A piece with a blocking edge starts only after its prerequisite is committed, and its branch comes from the prerequisite's branch instead of `main`.

**The builder brief** (keep it about this size):

```
Build <piece> in the worktree at <path> (work only there). Do not commit.
What: <ticket text: behaviour, acceptance criteria, how to prove it; spec excerpt if needed>
Design: <frame, or "follow the existing screens and /_system">   (UI only)
Rules: AGENTS.md, plus <the docs/internals file for this area>. Copy the shape of the reference slice.
Prove it: the tests at the ticket's seam; run only the affected tests, lint and typecheck.
If you find an important boundary the ticket missed (e.g. authorization), add its test and say so.
Comments only for what the code can't say.
Report: what you changed (files), what you proved (commands and results), anything unresolved.
```

## 3. Review before commit

Each piece gets one review, routed by consequence using the routing table's tiers. Size and a "UI" label never decide the tier.
- **Ordinary:** Sol high.
- **Important:** changed or removed arguments or returns of existing functions, APIs other apps consume, substantial behaviour changes, integrations. Sol xhigh. A new function alone is ordinary.
- **High-stakes:** Sol xhigh and Opus xhigh, in parallel.

Sol runs through T3 `delegate_task` (`mode: "wait"`, `timeoutMs: 1800000`), read-only, at a pinned effort. **If T3 is unreachable, stop and tell the owner. Never swap a model silently.**

**The reviewer brief:**

```
Read-only review. Target: worktree <path>, base <sha>. Read `git diff <sha>` plus untracked files
(`git ls-files --others --exclude-standard`).
It should do: <acceptance criteria + spec excerpt, pasted>.
Rules: AGENTS.md and <docs/internals file>.
Look for, in order: correctness and security; the acceptance criteria; callers the change breaks;
missed surfaces and reverse states; over-engineering; a missing test where money, access or data could break.
High-stakes backend: every public function checks identity (and tenant through the resource), server-only
code is internal, every argument is validated, returns are narrow.
Don't flag: style, untouched old code (you may follow unchanged callers to show a regression), speculation.
Output: ranked findings, each with a concrete failing case, then one word: CLEAN or FINDINGS.
If you can't read the target, answer BLOCKED.
```

**Triage.** Sort every finding into one of four outcomes:
- fix;
- ask the owner;
- defer, as a Linear issue if the owner agrees;
- dismiss, with a one-line reason.

**Fixes.**
- The builder that wrote the code fixes it; continue the same agent.
- A re-look happens only when a fix changed behaviour, and it goes to the reviewer that raised the finding.
- When fixes stop converging, label the ticket `needs-decision`, tell the owner, and keep going with the rest of the batch.

## 4. Commit

You commit, in the worktree, with the Linear key in the message (`feat(account): … (APP-12)`). Without a tracker, leave the key out. Builders never commit.

## 5. Integration check

1. **The batch branch** is the first piece's branch. In its worktree, merge the other pieces' branches, then run typecheck.
2. Walk the batch's acceptance criteria.
   - **UI:** an Opus high subagent clicks through the changed flows in a browser, once per batch, in the batch's worktree.
     - It starts the app as `AGENTS.md` "Dev servers" says, against the dev backend with the seed data, and reads the test code as "Test data" says, never printing it. It stops what it started by the PIDs it captured.
     - **Custom profiles, a batch with a migration:** it walks against a temporary Neon branch of `dev` (`neonctl branches create --parent dev --name <slug> --project-id "$(gh variable get NEON_PROJECT_ID)"`), migrated and seeded, with the worktree's linked `.env.local` (multi: `apps/api/.env.local`) replaced by a copy holding that branch's URLs. It deletes the branch afterwards. Never migrate the shared `dev`.
     - **It checks:** the frame at 1440 and 390, long content, both themes if any, empty, loading, error and permission states, keyboard and focus, accessible names, and errors tied to their fields. It reports what it actually checked.
   - **Backend flows** are proven by their seam tests.
3. Code that resolves an integration conflict gets reviewed.
4. Run the full build and tests locally only when CI is down.

## 6. PR

- **Opening it:** push the batch branch, then `gh pr create` from it, with a conventional, plain-language title that includes the Linear key. Link the PR with T3 `link_pull_request` when it's available.
- **The body:**
  - the problem in a sentence or two, and the fix;
  - before/after screenshots when the look changed, never committed. Host them in a secret gist: `gh gist create`, then clone it and push the images with `-c credential.helper='!gh auth git-credential'`. Link the raw URLs;
  - the one-way or two-way door line, e.g. "Two-way door: a flag flip reverts it", or "One-way door: drops column X";
  - the Linear issue links;
  - who built and reviewed it, e.g. "Built by Opus 5.5 high; reviewed by Sol high (2 findings, both fixed)";
  - follow-ups, e.g. a later removal the additive rule requires: as Linear issues, or a "Follow-ups" line when there's no tracker;
  - for high-stakes PRs, one review line, e.g. "Sol xhigh + Opus xhigh: 6 findings, 5 fixed, 1 dismissed (reason)".
- **CodeRabbit:** add the `coderabbit` label when the PR has important or high-stakes work, or is medium or bigger (real code across several files or more than one area; generated files and lockfiles don't count).
  - Triage its comments like any other finding.
  - Ask for a re-review only when behaviour changed.
  - It's never required. If it hasn't reported by the time CI is green, the PR says so and you go on.
- **CI green means:** verify, the Vercel build, and the preview e2e, all for the head SHA. Watch with `gh pr checks <n> --watch`. Then confirm e2e itself passed (it appears seconds after Vercel's success): `gh pr checks <n> --json name,bucket --jq '.[] | select(.name == "e2e") | .bucket'` must print `pass`.

## 7. Merge (this deploys production)

- **User-visible changes:** post the preview link and what to look at, wait for the owner's OK, then merge.
- **Backend-only changes:** merge once CI is green.
- **High-stakes and data PRs:** the owner merges.
- **Data changes:**
  - the owner takes a backup first (Convex dashboard or Neon), and the PR states the undo;
  - an additive optional field needs neither;
  - narrowing takes three PRs (widen, migrate, narrow), and you narrow only after the migration has completed;
  - a public function's arguments and return value change only additively.
- **CI failing for infrastructure reasons** (e.g. billing): merge only on the owner's agreement, after the full suite passes locally.
- **How,** from the main checkout, never inside a worktree:
  1. `gh pr merge <n> --squash --delete-branch --subject "<PR title> (#<n>)" --body "Co-Authored-By: <the builder model's attribution line>"`. It also removes the batch branch's worktree;
  2. remove every other piece's worktree and branch: `git worktree remove <path> && git branch -D <branch>`;
  3. `git pull --ff-only`.
- **After merge:** one quick production check:
  - the deployment for the merge SHA is Ready;
  - `/sign-in` and `/api/auth/ok` return 200;
  - the push CI run on `main` passed.

  The feature itself was proven on the preview.

## 8. Stop

Your last message says:
- what shipped;
- what's waiting on the owner;
- the next command.

If the context gets heavy, finish the current piece, stop, and tell the owner to re-run `/build`.

## Small work

- **A small, clear change:** the same loop with one piece.
- **A tiny tweak** (copy, spacing, a label): straight to `main`, with no PR and no review.
  1. Edit it yourself and show the owner.
  2. Run lint, typecheck and any affected test.
  3. Commit and push. That deploys it.
- **An obvious bug:** a small change.
- **A hard bug:** Sol xhigh diagnoses (read-only, through T3), then Opus high fixes. Add a regression test when the bug touched important behaviour.

## Never

- Builders committing, pushing, running dev servers, or deploying.
- Keeping reports, plans, handovers, or review findings that were fixed or dismissed.
