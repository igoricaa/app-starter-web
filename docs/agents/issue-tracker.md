# Issue tracker: Linear

Specs and tickets live in Linear, in the team and project named in `AGENTS.md` (Agent skills → Issue tracker). Use the Linear MCP tools (`save_issue`, `get_issue`, `list_issues`, `save_comment`, `list_issue_labels`, `create_issue_label`).

## Conventions

- **A spec** is a parent issue. `/to-spec` writes it.
- **A ticket** is a sub-issue of its spec (`parentId`). `/to-tickets` writes tickets in dependency order, so blocking links can name real identifiers.
- **Blocking:** use Linear's native `blockedBy` relation. A ticket is unblocked when every blocker is Done.
- **What a ticket holds:**
  - what to build, as end-to-end behaviour;
  - acceptance criteria;
  - how to prove it: the test seam, or "no test: UI only";
  - `Design:` the frame, when it has one.

  Never models, efforts, tiers or review classes. Those come from the routing table in `AGENTS.md`.
- **Read an issue:** `get_issue`, with its comments, when a skill says "fetch the relevant ticket".
- **Publish:** `save_issue` creates the issue, when a skill says "publish to the issue tracker".
- **States:**
  - Todo;
  - In Progress, when a builder starts;
  - In Review, when the PR opens;
  - Done, when the PR merges.

  The Linear GitHub integration moves states when the branch or PR title has the issue key.
- **Labels:**
  - `ready-for-agent` on tickets `/to-tickets` creates;
  - `needs-decision` when fixes stop converging, or a product question blocks the ticket;
  - `wayfinder:*` as below.

  Don't invent other labels.
- **Deferred defects and accepted risks** become issues only on the owner's yes.
- **No status comments.** Comment only with something a later reader needs: a decision, a blocker, a research answer.

## Wayfinding operations

Used by `/wayfinder`.

- **The map** is one issue labelled `wayfinder:map`. It holds the Notes / Decisions so far / Fog body.
- **A child ticket** is a sub-issue of the map, labelled `wayfinder:research`, `wayfinder:prototype`, `wayfinder:grilling` or `wayfinder:task`.
- **Blocking** uses the native `blockedBy` relation.
- **The frontier query:** list the map's open sub-issues, then drop any that has an open blocker or an assignee. The first in map order wins.
- **Claim:** assign the ticket to me. This is the session's first write.
- **Resolve:** comment the answer, move the ticket to Done, then append a gist and link to the map's Decisions so far.

**Research override.** There is no `research` skill here.
- A research ticket is answered by a Sol medium subagent, through T3 `delegate_task`, using the web and the repo.
- Its answer becomes the ticket's closing comment: no branch, no file.
- Research is saved in the repo only when the owner says so.
