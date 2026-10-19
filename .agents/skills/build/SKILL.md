---
name: build
description: The build loop. Group tickets into pieces, run builders in worktrees, review before commit, open PRs and merge, which deploys production. Use when the owner types /build with Linear tickets, a milestone, or a described change.
disable-model-invocation: true
---

# Build

You are the coordinator: Opus 5.5 at high. You route work, triage findings, commit, open PRs and merge. You write code yourself only for tiny tweaks.

`AGENTS.md` has the routing table, the ways to hurt yourself and the verification rules. Read it first. Linear operations are in `docs/agents/issue-tracker.md`.

## 0. Reconcile

After a crash, first resume the transcript. In a fresh session, read what is already there:
- worktrees (`git worktree list`) and their state;
- the tickets' Linear states;
- open PRs (`gh pr list`);
- live child tasks.

Committed pieces are done. Uncommitted pieces get a fresh review.

## 1. Group

- Turn the tickets into **pieces**: coherent work for one builder, covering one or more tickets.
- Group the pieces into **PR batches**.
- **High-stakes work** (money, authorization and tenancy, migrations and deletion, concurrency, billing webhooks) gets its own PR. So does every data change.
- Never make a huge PR.
- Show the owner the grouping in a few lines, then start; don't wait for approval unless something is ambiguous.
- Move tickets to In Progress when work starts.

## 2. Build

- **Dispatch.** One builder per piece, in its own worktree, with the model and effort from the routing table. Pin both on every dispatch.
  - Claude builders: the Agent tool with `isolation: "worktree"`.
  - Codex models: T3 `delegate_task` with `isolation: "worktree"`.
- **Parallel or serial.** Builders run in parallel only when they share no files or resources. Pieces that touch the schema (`convex/schema.ts` or `src/server/schema.ts`) run one after another.

**The builder brief** (keep it about this size):

```
Build <piece> in this worktree. Do not commit.
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
- **Important** (public contracts, substantial behaviour changes, integrations): Sol xhigh.
- **High-stakes:** Sol xhigh and Opus xhigh, in parallel.

Sol runs through T3 `delegate_task`, read-only, at a pinned effort. **If T3 is unreachable, stop and tell the owner. Never swap a model silently.**

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

You commit, in the worktree, with the Linear key in the message (`feat(account): … (APP-12)`). Builders never commit.

## 5. Integration check

1. Merge the batch's pieces onto one branch and run typecheck.
2. Walk the batch's acceptance criteria.
   - **UI:** an Opus high subagent clicks through the changed flows in a browser, once per batch. It runs against the dev backend with the seed data, at 1440 and 390, and reports what it actually checked. Only this step pushes to the dev deployment.
   - **Backend flows** are proven by their seam tests.
3. Code that resolves an integration conflict gets reviewed.
4. Run the full build and tests locally only when CI is down.

## 6. PR

- **Opening it:** `gh pr create` with a conventional, plain-language title that includes the Linear key. Link the PR with T3 `link_pull_request` when it's available.
- **The body:**
  - the problem in a sentence or two, and the fix;
  - before/after screenshots for UI, uploaded to GitHub, never committed;
  - the one-way or two-way door line, e.g. "Two-way door: a flag flip reverts it", or "One-way door: drops column X";
  - the Linear issue links;
  - who built and reviewed it, e.g. "Built by Opus 5.5 high; reviewed by Sol high (2 findings, both fixed)";
  - for high-stakes PRs, one review line, e.g. "Sol xhigh + Opus xhigh: 6 findings, 5 fixed, 1 dismissed (reason)".
- **CodeRabbit:** add the `coderabbit` label when the PR has important or high-stakes work, or is medium or bigger (real code across several files or more than one area; generated files and lockfiles don't count).
  - Triage its comments like any other finding.
  - Ask for a re-review only when behaviour changed.
  - It's never required. If it doesn't report, the PR says so.
- **CI green means:** verify, the Vercel build, and the preview e2e, all for the head SHA. Use `gh pr checks <n> --watch`.

## 7. Merge (this deploys production)

- **User-visible changes:** post the preview link and what to look at, wait for the owner's OK, then merge.
- **Backend-only changes:** merge once CI is green.
- **High-stakes:** the owner merges.
- **Data changes:**
  - the owner takes a backup first (Convex dashboard or Neon), and the PR states the undo;
  - narrowing takes three PRs (widen, migrate, narrow), and you narrow only after the migration has completed;
  - a public function's arguments and return value change only additively.
- **CI failing for infrastructure reasons** (e.g. billing): merge only on the owner's agreement, after the full suite passes locally.
- **How:** squash merge, `gh pr merge <n> --squash --delete-branch`. Then remove the worktrees.
- **After merge:** one quick check that production is up and the change works (open the production URL, sign in if needed).

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

- Builders committing, pushing, running `convex dev`, or deploying.
- Running more than 6 Opus agents at high or xhigh at once, or more than 10 agents in total, nested included.
- Using Haiku.
- Keeping reports, plans, handovers, or review findings that were fixed or dismissed.
