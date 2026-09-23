# Voice access — open questions from the characterisation tests

Behaviour the phase 1 characterisation suite found that **looks like a bug rather than a design
choice**. Nothing here has been fixed. Characterisation captures what the code *does*, so each
item is **pinned as-is** by a test tagged `[OQ-n]`. Changing any of them later is a deliberate
decision, and it shows up as a visible test diff.

For each item: what happens, the evidence, why it looks unintended, what the test pins, why it
matters for voice, and the question for review. Severity is a first read for triage, not a
verdict.

Code references are to `feature/voice-assistant` after the merge of `development` at `c4ee5d04`.

**Decisions (2026-09-23):** OQ-1 and OQ-2 are **decided**: both are fixed in phase 2, each in its
own commit, as specified in the plan (§4.7). OQ-6 has gone to the team as a **chat bug, outside
this branch**; its test stays pinned. The rest are open.
The suite and its coverage map are described in
[`03-characterisation-tests.md`](./03-characterisation-tests.md).

| # | Summary | Severity | Status | Pinned by |
|---|---|---|---|---|
| [OQ-1](#oq-1--a-stop-during-a-tool-call-leaves-the-branch-permanently-broken) | A stop during a tool call leaves the branch permanently broken | **High** | **Decided**, fix in phase 2 | L25, L26, L27 (+ L18, L21) |
| [OQ-2](#oq-2--the-tic-rule-cannot-be-followed-no-tool-says-whether-a-tic-exists) | The TIC rule can't be followed: no tool says whether a TIC exists; no-budget projects read "over budget" | **High** | **Decided**, fix in phase 2 | M05, M06, M07 |
| [OQ-3](#oq-3--tool-round-trips-count-against-the-user-message-rate-limit) | Tool round trips count against the user-message rate limit | Medium | Open | P14 |
| [OQ-4](#oq-4--synthetic-answers-are-emitted-even-when-they-were-not-persisted) | Synthetic answers are emitted even when they weren't persisted | Low | Open | L18, L47 |
| [OQ-5](#oq-5--tool_result-events-are-sent-before-their-row-exists) | `tool_result` events are sent before their row exists | Medium | Open | L21 |
| [OQ-6](#oq-6--is_fully_paid-is-true-when-nothing-has-been-invoiced) | `is_fully_paid` is true when nothing has been invoiced | Medium | **With the team**, as a chat bug; outside this branch | M16 (+ M15) |
| [OQ-7](#oq-7--a-pre-stream-failure-can-leave-an-empty-session-behind) | A pre-stream failure can leave an empty session behind | Low | Open | P24 |
| [OQ-8](#oq-8--with-a-text-attachment-the-route-line-lands-on-the-attachment) | With a text attachment, the route line lands on the attachment | Low | Open | L34 |
| [OQ-9](#oq-9--the-per-tool-timeout-timer-is-never-cleared) | The per-tool timeout timer is never cleared | Low | Open | (harness note) |
| [OQ-10](#oq-10--informational) | Informational: RLS-only invoice scoping; stale generated types | Info | Scoping → v1 pre-ship RLS gate | M13 |

---

## OQ-1 — A stop during a tool call leaves the branch permanently broken

**What happens.** The assistant row holding `tool_use` blocks is persisted *before* the tools run.
Its `tool_result` row is persisted only after *all* tools finish. If the loop exits in between,
the `tool_use` row is left with no answer. That happens when the cancel beacon trips after
dispatch ([`index.ts:1375`](../../supabase/functions/ai-chat/index.ts#L1375)), when the
`tool_result` insert fails (OQ-5), or when the truncation guard's own insert fails (OQ-4). The
active-branch rule then makes that row the leaf: the frontend's `computeMostRecentLeaf`
([`normalizeMessages.ts:262`](../../src/components/AiChat/lib/normalizeMessages.ts#L262)) picks the
newest row. **Every later message on that branch is sent to Anthropic with a `tool_use` that has no
`tool_result` after it, and the real API rejects it (400).** The user sees `model_bad_request` on
every retry. The only way out is to edit an earlier message, which starts a new branch.

A related detail: a stop requested **while the model call is in flight** does not stop the tool.
The beacon is only checked *after* dispatch, so the tool runs and its result is thrown away.

**Evidence.**
- L25: a stop during dispatch leaves rows `[user, assistant(tool_use)]`, and no `tool_result` row.
- L26: two follow-ups on that branch are both rejected. The fake enforces the real API's pairing
  rule, and the test asserts that the rejection came from that rule, not from a missing script.
- L27: a stop requested during the model call still runs the tool.
- L18 and L21 reach the same dangling state through failed inserts.

**Why it looks unintended.** `docs/AI_CHAT.md` → Cancellation says "stopping mid-stream therefore
preserves whatever the user already saw on screen; on a refresh they see the partial conversation".
It doesn't mention that the conversation can no longer be continued.

**Pinned.** Current behaviour: a follow-up gets `model_bad_request`.

**Voice.** High relevance. Barge-in and hang-up mid-lookup are routine on a call. The voice path
takes its history from the platform (plan §7), so it would not replay this exact row, but it shares
the loop. Any cancellation or timeout added for voice goes through the same after-dispatch exit.

**Question.** Should the exit paths persist `tool_result` blocks for the tools that were dispatched
(for example, marked as cancelled)? Or should history replay repair or skip an unanswered
`tool_use`? Either way it is a behaviour change to decide before phase 3, not something to slip
into the refactor.

**✅ Decided (2026-09-23): both, in phase 2, as their own commit.** (a) At message assembly, an
unanswered `tool_use` gets a synthetic `tool_result` ("cancelled by user") injected in memory, so
threads that are already stuck recover. (b) In the refactored loop, cancellation is a first-class
exit: on abort, the `tool_result` row is persisted before exiting (real results for tools that
finished, synthetic ones for the rest), and the beacon is also checked before dispatch. A
conversation must never end on a bare tool call. Full specification: plan §4.7. Tests that change
in that commit: L25, L26, L27, plus a new invariant test and a recovery test.

## OQ-2 — The TIC rule cannot be followed: no tool says whether a TIC exists

**What happens.** The system prompt and the `get_project_financial_summary` description both say
that a project without a TIC has **no planned budget**, and that the model must say "budžet nije
postavljen" instead of quoting `projects.budget`, "even if a tool returns a number". But:

- `get_project_financial_summary` returns `projects.budget` as `project_budget` and computes
  `remaining_to_commit`, `remaining_to_spend` and `over_budget` from it
  ([`tool-handlers.ts:963`](../../supabase/functions/_shared/tool-handlers.ts#L963)).
- `get_project_details` returns `projects.*` ([`tool-handlers.ts:355`](../../supabase/functions/_shared/tool-handlers.ts#L355)).
- **No tool reads `tic_cost_structures`**, and nothing in any payload indicates whether a TIC
  exists.

So the model cannot tell a TIC-derived budget from a stale hand-typed one. Worse, for a project with
no TIC and a NULL budget, `Number(null) || 0` gives a budget of **0**. With any contract,
`remaining_to_commit` goes negative and **`over_budget: true`**.

**Evidence.**
- M05: a legacy project (no TIC, `budget = 500 000`) gets back `budget: 500 000`, the payload never
  mentions a TIC, and no request touches `tic_cost_structures`.
- M06: a project with no TIC and no budget, with 80 000 committed, gets back `budget: 0`,
  `remaining_to_commit: −80 000` and `over_budget: true`.
- M07: `get_project_details` returns the legacy budget and no TIC indicator.

**Why it looks unintended.** The rule was added with `20260909140000_tic_sole_budget_source.sql`
and written into the prompt and the tool description, but the handlers were not changed to support
it.

**Pinned.** The current payloads, exactly.

**Voice.** High. "Jesmo li u budžetu?" is the canonical voice question, and a spoken "yes, 500 000
left" or "you're 80 000 over budget" is worse than a written one: there's no table to cross-check.

**Question.** Should the financial tools report TIC presence (for example `has_tic`, or
`project_budget: null` without a TIC), so the prompt rule can actually be followed? This is also a
money-correctness question for chat today.

**✅ Decided (2026-09-23): yes, in phase 2, as its own commit.** `get_project_financial_summary` and
`get_project_details` report `tic: { exists, budget }`, with the TIC total when one exists, so the
model applies the no-TIC-no-budget rule from data. The affected tests (M05–M07, M04, and M01/M02 if
the wording changes) are updated in the same commit. A follow-on choice goes to that commit's
review: whether to null `project_budget`, `remaining_*` and `over_budget` when there is no TIC
(plan §4.7).

## OQ-3 — Tool round trips count against the user-message rate limit

**What happens.** The limiter counts `ai_messages` rows with `role = 'user'`
([`rateLimit.ts:53`](../../supabase/functions/_shared/rateLimit.ts#L53)). Tool results are persisted
as `role = 'user'` rows too, as the Anthropic wire contract requires. So the documented "20 user
messages per 5 minutes" is really "20 user messages *plus* tool round trips". A few tool-heavy
questions exhaust it.

**Evidence.** P14: twenty `tool_result` rows alone trigger `rate_limited`.

**Why it looks unintended.** Both `docs/AI_CHAT.md` and the code comment describe the limit as
counting "user messages".

**Pinned.** Tool-result rows count.

**Voice.** Plan §7 already gives voice a separate budget. This finding says chat's own budget is
tighter than documented.

**Question.** Should the count exclude rows whose content is only `tool_result` blocks?

## OQ-4 — Synthetic answers are emitted even when they were not persisted

**What happens.** The loop's contract is "persist, then emit". Two synthetic paths break it:

- The truncation guard ignores the result of its `tool_result` insert
  ([`index.ts:1455`](../../supabase/functions/ai-chat/index.ts#L1455)). It skips the synthetic
  assistant row if that insert failed, but still emits the explanation `turn`. That insert
  failure also leaves the OQ-1 dangling state.
- The iteration-cap message is emitted even if its insert failed. This one is logged
  ([`index.ts:1528`](../../supabase/functions/ai-chat/index.ts#L1528)), so it may be deliberate.

**Evidence.** L18, L47.

**Pinned.** In both cases the text is emitted while its row is missing.

**Question.** Is this intended, as best effort? If so, the persistence-order section of
`docs/AI_CHAT.md` should say so.

## OQ-5 — `tool_result` events are sent before their row exists

**What happens.** Each `tool_result` SSE event is written as soon as its handler returns
([`index.ts:1376`](../../supabase/functions/ai-chat/index.ts#L1376)). The single `tool_result` row
is inserted only after all handlers finish ([`index.ts:1392`](../../supabase/functions/ai-chat/index.ts#L1392)).
If that insert fails, the client has already rendered results that don't exist in the database, and
the assistant `tool_use` row is left dangling (OQ-1).

**Evidence.** L21: events are `[session, tool_call, tool_result, error(persistence_error)]`, and the
rows are `[user, assistant]`.

**Why it looks unintended.** `docs/AI_CHAT.md` → Persistence order: "the loop … never emits the
corresponding `turn` / `tool_call` / `tool_result` event. The client never sees a 'ghost' event with
no underlying row." That holds for `turn` and `tool_call`, but not for `tool_result`.

**Pinned.** The `tool_result` event is emitted, and the row is missing.

**Question.** Is this a doc fix (the per-handler progress is the point of emitting early), or a
code fix? Phase 2's parallel dispatch reorders these events anyway, so it is worth deciding before
then.

## OQ-6 — `is_fully_paid` is true when nothing has been invoiced

**What happens.** `get_subcontractor_payment_status` sets
`is_fully_paid: invoices_total_remaining === 0`
([`tool-handlers.ts:693`](../../supabase/functions/_shared/tool-handlers.ts#L693)). A subcontractor
with 250 000 contracted and **no invoices yet** is reported as fully paid.

A related ambiguity: in the same payload, `summary.paid` is the sum of invoice `paid_amount`, while
`contracts.total_realized` is the trigger-maintained contract figure. These are two different
"paid" numbers, and they need not agree (M15: 100 000 vs 370 000).

**Evidence.** M16, M15.

**Pinned.** `is_fully_paid: true` with nothing invoiced, and both figures as they are.

**Voice.** "Je li izvođač X isplaćen?" → "Da, u potpunosti." That is a plausible spoken answer to a
wrong fact.

**Question.** Should `is_fully_paid` require something to have been invoiced, or compare against the
contracted amount? And which "paid" should the model quote?

**➡️ Handed to the team (2026-09-23)** as a chat bug, to be fixed outside `feature/voice-assistant`.
M16 stays pinned on this branch until that fix lands and is merged in; M16 then changes with it.

## OQ-7 — A pre-stream failure can leave an empty session behind

**What happens.** A new session row is created ([`index.ts:821`](../../supabase/functions/ai-chat/index.ts#L821))
before the user row is inserted ([`index.ts:1021`](../../supabase/functions/ai-chat/index.ts#L1021)).
If anything between them fails — a user-row insert, an attachment download or the attachment
side-table insert — the request returns 500 and leaves an untitled session with no messages. It
appears in the user's history list.

**Evidence.** P24.

**Pinned.** The empty session remains.

**Question.** Is this acceptable, or should those failures clean up a session that this request
created?

## OQ-8 — With a text attachment, the route line lands on the attachment

**What happens.** The route context is prepended to the *first* text block
([`index.ts:1171`](../../supabase/functions/ai-chat/index.ts#L1171)). A text attachment is itself a
text block, placed before the typed message, so the `[Kontekst: …]` line is prepended to the
attachment's content, not to the user's question.

**Evidence.** L34.

**Why it looks unintended.** The code comment says the context is prepended "to the typed message",
and `docs/AI_CHAT.md` says the lookup "is type-keyed so a different ordering wouldn't silently
clobber" anything. With text attachments there are several text blocks, and the first one is not
the typed message.

**Pinned.** The line is on the attachment block.

**Voice.** None: attachments are not part of voice. This is chat-only.

**Question.** Should the lookup target the *last* text block, which by convention is the typed
message?

## OQ-9 — The per-tool timeout timer is never cleared

**What happens.** `dispatchToolWithTimeout` races each handler against a 15 s `setTimeout`
([`index.ts:330`](../../supabase/functions/ai-chat/index.ts#L330)) that is never cleared when the
handler wins. A timed-out handler is also not cancelled: it keeps running. In the Edge runtime,
each tool call leaves a timer pending for up to 15 s.

**Evidence.** It's the reason the test harness disables Deno's op sanitizer (see `harness.ts` →
`scenario`).

**Question.** Harmless, or worth a `clearTimeout` (and an `AbortSignal` to the handler) when the
loop is extracted in phase 3?

## OQ-10 — Informational

- **Invoice scoping for Supervision users relies on RLS alone.** `list_contracts` adds an explicit
  `project_id in (assigned)` filter. `list_unpaid_invoices` adds none and relies on the RLS policies
  on `accounting_invoices` (M13). That is consistent with the docs, but it is inconsistent defence
  in depth. The fake cannot evaluate RLS, so the suite pins only the request shape. **Now a v1
  pre-ship gate:** an RLS integration test against a real Postgres (plan §10, "v1 pre-ship gates").
- **The generated types are missing `contracts_classification_id_fkey`.** `list_contracts` embeds
  through that FK, and the migration creates it, but `_shared/database.ts` has no such relationship.
  The fake adds it by hand. This is just stale types: the next `npm run db:types` should pick it up.
