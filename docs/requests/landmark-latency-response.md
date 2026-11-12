# Response: `assistant-api` latency request of 2026-11-11

From the Landmark side, 2026-11-12. This answers *Request for the Landmark repository: three changes
that make `assistant-api` faster to speak*.

**Status:** all three are built and tested on `feat/assistant-api-latency`, but **not deployed**.
LandmarkDev still runs the previous version. We will send a note when it is deployed. Until then,
nothing changes for you.

## In short

| Ask | What we did | What changes for you |
|---|---|---|
| 1. Session reuse | One session per user, reused for up to 5 minutes | Nothing to change. Parallel calls for one user are safe again |
| 2. List the caller's projects | `search_projects` with no `query` lists them all | Same tool, same name. The schema has no required field now |
| 3. Shorter descriptions | The twelve rewritten in place, all ≤ 300 characters, `search_help`'s now English | Re-pull `/manifest`. No `voice_description` field |

The exposed list is still the same twelve names. The new manifest `version` is:

```
6a9b191f7ce7b27c7ae8c0815ca98ffc27236a221663f399cf02b6b7d14794af
```

The current one on LandmarkDev, until the deploy, is `ad40be62df6edae8605e55bd4377ffb40bb902396da546e87463a839e839de5b`.

## 1. Session reuse

As asked, with one addition: minting is single-flight.

- **Cache.** The function keeps the minted access token per `public.users.id`, in memory, per
  isolate. It reuses it for 5 minutes or until 60 s before the token's own expiry, whichever is
  shorter.
- **One mint per user.** Requests that arrive while a session is being minted wait for that one
  mint instead of starting their own. This is what removes the `500 internal_error` you saw when
  five searches ran at once. You can let calls overlap again.
- **Authorisation is unchanged.** `authenticateToken` still runs on every request, so a role
  change or a new project assignment shows on the next call.
- **When a session is dropped and signed out:**
  - when it is past its window, at the start of the next request
  - when GoTrue (`getUser`) or PostgREST answers 401 for it
  - when the user's row now points at a different auth account
  - when the isolate shuts down (best effort)
- **Retry.** After a 401 the request runs **once more** with a fresh session, which is invisible to
  you. A second 401 is answered as before: `500 internal_error`, or the handler's own `{ error }`.
  A retried call can take up to two tool timeouts (2 × 6 s on voice) in that rare case.
- **Per isolate.** A cold start mints again, and two warm isolates each hold their own session for
  a user, so the first call on a fresh isolate still pays for the mint.

The tests you named are all in `supabase/functions/assistant-api/tests/assistant.test.ts`:

| Your test | Ours |
|---|---|
| A second call in the window makes no `generate_link` or `verify` request | A20 |
| A call after the window mints again | A21 (also covers the token's own expiry) |
| A 401 from a handler's read drops the token and retries once | A22 (also covers that a second 401 is not retried) |
| Two concurrent calls of one user both succeed | A24 (one mint between them) |

There is also A23: a session revoked elsewhere is refused by `getUser`, re-minted, and the call
answers.

**Numbers.** The test fake has no network latency, so these are request counts, not milliseconds:

| | Before | After |
|---|---|---|
| GoTrue requests per call, session reused | 5 | 1 (`getUser`) |
| GoTrue requests per call, session minted | 5 | 4 (`admin/users`, `generate_link`, `verify`, `getUser`) |
| Sessions minted for N calls by one user within 5 min | N | 1 |

So the saving shows from a user's second call on. Your bench's per-call 0.5–1.0 s should drop by
most of the minting share. Please measure it on LandmarkDev after the deploy.

The request log line gains `session: "minted" | "reused" | "retried"`, if you want to match your
timings to ours.

## 2. Listing projects: `search_projects` without a query

We took the first option. No new tool, so you have nothing to review or name.

- `query` omitted, `""` or blank lists **every project the caller may see**, in name order, capped
  by `limit` (default 20, max 100).
- With a query it searches by name as before, including the Croatian-stem retry.
- The fields are the same: `id`, `name`, `location`, `status`.
- The role gate and RLS are the same. Supervision is also filtered to its assigned projects
  explicitly, and a Supervision user with no assignments gets an empty list.
- On voice the usual clamp applies: five items and `total`.

The new schema:

```json
{
  "type": "object",
  "properties": {
    "query": {
      "type": "string",
      "description": "Substring to match against project name. Case-insensitive. Omit or leave empty to list every project you can see."
    },
    "limit": { "type": "integer", "description": "Maximum number of results to return.", "minimum": 1, "maximum": 100, "default": 20 }
  },
  "required": [],
  "additionalProperties": false
}
```

Your four searches per call can become one `search_projects {}` (pass `limit: 100` if the caller
may see more than 20). Tests: A25 covers name order, `limit`, Supervision with and without
assignments, and the voice clamp with `total`.

## 3. Shorter descriptions

- **Rewritten in place**, so there is no `voice_description` field. Landmark's own chat and voice
  get the same shorter texts.
- The data-model warnings were already in `DOMAIN_RULES_HR`, which every channel's system prompt
  carries, so nothing was lost.
- `search_help`'s description, and its `query` property, are now in English.

| Tool | Before | After |
|---|---|---|
| `search_projects` | 282 | 239 |
| `get_project_details` | 271 | 222 |
| `list_project_phases` | 1,020 | 275 |
| `search_subcontractors` | 368 | 206 |
| `list_cost_classifications` | 357 | 208 |
| `list_contracts` | 498 | 272 |
| `get_subcontractor_payment_status` | 313 | 226 |
| `list_unpaid_invoices` | 273 | 232 |
| `list_payments_for_subcontractor` | 316 | 191 |
| `get_invoice_summary` | 373 | 262 |
| `get_project_financial_summary` | 563 | 252 |
| `search_help` | 418 | 254 |
| **Total** | **5,052** | **2,839** |

The whole manifest went from 14,968 to 12,751 bytes. `domain_rules_hr` is unchanged. A test keeps
every exposed description at 300 characters or fewer. `/manifest` is the same across two calls
(A09); the `version` above changed once, with these texts and the `search_projects` schema.

## `search_help` refusing through the function

We could not reproduce it. Through the function, `search_help` answers `200` with **no** `error`
on both channels (A26). We think the cause is the answer's shape. `search_help` is the one exposed
tool whose handler does not wrap its result in `data`:

```
other tools:  { "data": { "data":  { "projects": […], "count": 1 } } }
search_help:  { "data": { "markdown": "## …", "matches": 3 } }
```

A client that reads `data.data` and treats a missing value as an error would report exactly what
you saw, while the data tools work. Could you check your side for that?

- **If that is it:** read `data.markdown` for `search_help`. We would rather not change the
  handler's shape, because Landmark's chat depends on it.
- **If it is not:** send us the time of one failing call on LandmarkDev, and we will read the
  function's log line for it.

On voice the markdown is still clipped to 200 characters. Titles plus a one-line summary for voice
is a separate open item on our side.

## After the deploy

When it is on LandmarkDev we will send you:

1. confirmation, and the manifest `version` as deployed (it should match the one above)
2. the result of our smoke test

Then please re-pull the manifest, re-run your bench, and tell us the new numbers. In particular,
check the *token verifications* rate limit: it should now be well clear, and we will close our
item for it once your bench confirms that.
