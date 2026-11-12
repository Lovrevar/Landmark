# assistant-api

An edge function that lets the company assistant (the VoiceAssistant repository) ask Landmark's
AI-chat tools a question on behalf of an employee, and get back exactly what Landmark's own chat
would. It adds no query of its own. Identity and role come from `_shared/auth.ts`. The role and
channel gate and the handlers come from `_shared/orchestrator.ts` and `_shared/tools.ts`. The
domain rules come from `_shared/prompts.ts`.

Code: [`supabase/functions/assistant-api/`](../supabase/functions/assistant-api/). Tests:
`assistant-api/tests/` (`deno task test` from `supabase/functions/`).

**Status (2026-11-12):** deployed to LandmarkDev, not to production. The assistant side's latency
request of 2026-11-11 is built and deployed to LandmarkDev (manifest `6a9b191f…`, smoke test
passing). Our answer is in [requests/landmark-latency-response.md](./requests/landmark-latency-response.md):

- sessions are reused per user
- `search_projects` lists every project when given no query
- the twelve descriptions are at most 300 characters each

The earlier addendum of 2026-11-09 (an `iat` in the future is refused; the exposed list is held to
a reviewed twelve on the assistant's side) is in.

## Who is calling: the assertion

Every request carries `Authorization: Bearer <assertion>`: an HS256 JWT signed with
`ASSISTANT_API_SECRET`, a function secret that the assistant holds too. In order, the function checks:

1. the signature, with `alg` `HS256` (`alg: none` and any other algorithm are refused)
2. `iss` is `va` and `aud` is `landmark-assistant-api`
3. `exp` is in the future, and `exp − iat` is at most 60 s
4. `iat` is not more than 30 s in the future. Without this, a token minted an hour ahead would
   pass every other check and outlive the `jti` memory below
5. `jti` is present and has not been seen in the last 120 s
6. `sub` is an email address; `*` and `%` are refused, because PostgREST reads them as wildcards

Any failure is `401 bad_assertion`. The log line names the failed check (a jose error code or
claim, or `lifetime_too_long`, `iat_in_future`, `jti_replayed`, `sub_not_email`, `missing_header`)
and never a claim's value.

Seen `jti`s are kept **in memory, per isolate**. A cold start forgets them, which a token that
lives 60 s makes acceptable.

## Which Landmark user: the mapping

`sub` is the employee's email. With the service role, the function looks for the one
`public.users` row whose `email` equals it, case-insensitively, with `_` escaped so it matches only
itself, and whose `auth_user_id` is set. No row, or more than one, is `403 not_mapped`.

The handlers read through the user's own RLS client, as in chat, so the function needs a real
session for that user:

1. `auth.admin.getUserById(auth_user_id)` returns the **auth** account's email. The link is minted
   for the account the row points at, even if `public.users.email` has drifted.
2. `auth.admin.generateLink({ type: 'magiclink', email })` returns `properties.hashed_token`. No
   email is sent.
3. `auth.verifyOtp({ token_hash, type: 'magiclink' })` runs on an anon-key client and returns
   `session.access_token`.
4. `authenticateToken(access_token)` re-reads role and assigned projects, exactly as for chat. The
   function also checks that the session's user is the mapped row.

Steps 1–3 run once per user for a few minutes, not once per request. Step 4 runs on every request,
so a changed role or assignment shows on the next call. The cache is `SessionCache` in
`session.ts`, keyed by `public.users.id`:

- **Window.** A session is reused for 5 minutes, or until 60 s before the token's own expiry,
  whichever comes first.
- **One mint at a time.** Calls that arrive while a session is being minted wait for that one
  mint. GoTrue keeps one pending magic link per user, so two parallel mints made the first fail
  (`verifyOtp failed`, 500). Parallel calls for one user are fine now. A failed mint is not
  cached; the next call tries again.
- **Dropped and signed out** (`auth.admin.signOut(token, 'local')`, best effort, a failure
  logged):
  - when it is past its window, at the start of the next request
  - when GoTrue or PostgREST answers 401 for it
  - when the user's row points at a different auth account
  - at isolate shutdown (`beforeunload`)

  A dropped session is signed out only once no request still holds it.
- **Retried once on a 401.** If `getUser` refuses the session (revoked elsewhere), or a handler's
  read gets a 401 from PostgREST, the session is dropped and the whole request runs once more with
  a fresh one. That is safe because all twelve tools only read. A second 401 is answered as before:
  500 from `getUser`, or the handler's own `{ error }`. A retried tool call can take two tool
  timeouts.
- **Per isolate.** The cache is in memory, like the `jti` memory. A cold start mints again, and two
  warm isolates each hold their own session for a user.

The link, the hash and the token are never logged.

## Routes

All `POST`, JSON in and out. Failures are `{ "error": { "code": "…", "message": "…" } }` with a real
status.

| Route | Body | Answer |
|---|---|---|
| `/assistant-api/me` | `{}` | `{ "role", "display_name", "tools": { "chat": [names], "voice": [names] } }` |
| `/assistant-api/manifest` | `{}` | `{ "version", "tools": [{ "name", "description", "input_schema", "roles", "voice" }], "domain_rules_hr" }` |
| `/assistant-api/tools/<name>` | `{ "input": {…}, "channel": "chat" \| "voice" }` | `{ "data": … }` |

- **`/me`**: `display_name` is `public.users.username`, or the email's local part when the row
  has no username (the same fallback as the `profiles` trigger). Each tool list is
  `selectAvailableTools(ctx, channel)`, filtered to the exposed tools, so it lists only what this
  API will accept. A Director gets twelve on each channel, Sales seven.
- **`/manifest`**: needs a valid assertion but no mapped user. `version` is the SHA-256 of the
  JSON of `{ tools, domain_rules_hr }`, so it changes exactly when a tool's description, schema or
  roles, or the domain rules, change.
- **`search_projects` without a query** (omitted, `""` or blank) lists every project the caller
  may see, in name order, capped by `limit` (default 20). Supervision gets only its assigned
  projects; with none, the answer is empty and no query runs. Give part of a name to search, as
  before.
- **`/tools/<name>`**: `data` is **literally** what `dispatchTool` returned. Handlers return
  `{ data: … }` or `{ error: '…' }`, so a success is `{ "data": { "data": { "projects": […],
  "count": 1 } } }`.
  - **`search_help` is the exception to the inner `data`.** It returns `{ markdown, matches }`,
    so its answer is `{ "data": { "markdown": "…", "matches": 3 } }`, with no second `data`. A
    client that looks for `data.data` reads it as missing.
  - **A handler's own `{ error }` is an answer, not a failure.** It comes back as
    `200 { "data": { "error": "Project not found or not accessible" } }`, which is what chat's model
    sees as an `is_error` tool result. This is a deliberate departure from the request document,
    which mapped "a handler error" to 500. Only a thrown error or a timeout is a 500.

### Exposed tools

The twelve in `TOOL_ALLOWLIST.voice` (voice plan §5), on **both** channels. `create_document`,
`list_documents_for_entity` and `get_document_download_link` are not exposed.

Their descriptions are at most 300 characters each (`_shared/tools.test.ts` checks it): what the
tool returns, when to call it and when not to. The data-model warnings are in `domain_rules_hr`,
which every channel's system prompt carries.

The assistant side holds its manifest snapshot to a reviewed list of these twelve names and
refuses a thirteenth until someone reviews it there. **If this list changes, tell the assistant
team** in the same change; `/manifest`'s `version` changing is not enough on its own.

### Refusals

The checks run in this order, and each one stops the request.

| Status | Code | When |
|---|---|---|
| 405 | `method_not_allowed` | not `POST` |
| 404 | `not_found` | not one of the three routes |
| 401 | `bad_assertion` | see above |
| 404 | `unknown_tool` | a tool outside the twelve, on either channel; no database work is done |
| 413 | `payload_too_large` | body over 64 KB |
| 400 | `bad_request` | body not a JSON object, `channel` not `chat`/`voice`, `input` not an object, or `input` failing the tool's `input_schema` (the message names the field) |
| 403 | `not_mapped` | no single `public.users` row with a login for the email |
| 429 | `rate_limited` | more than 30 tool calls by one user in a minute |
| 403 | `forbidden_tool` | the user's role may not use the tool on that channel (`findAvailableTool`; `dispatchTool` checks again) |
| 500 | `internal_error` | the session could not be opened (or was refused again after one retry), the handler threw, or it ran past its timeout (6 s on voice, 15 s on chat), logged with the error class and code |

Input is checked against the tool's `input_schema` by `validate.ts`. In chat the schema is only
documentation for the model. The validator understands the keywords the twelve use, and at module
load it refuses any schema with a keyword it does not know. Defaults are not applied, because the
handlers apply their own.

The rate limit is **in memory, per isolate**, so it is best effort: two warm isolates each allow 30.
`/me` and `/manifest` don't count against it.

### Voice clamps

When `channel` is `voice`, `data` passes through `voice.ts`:

- An array longer than 5 is cut to its first 5 items, and a sibling `total` keeps the original
  length. If that object already has a `total`, or several of its arrays are cut, the sibling is
  `<key>_total` instead. A cut top-level array becomes `{ items, total }`.
- A string longer than 200 characters is clipped to 200 and `…`.
- Ids stay. The assistant needs them to chain calls, and its own prompt keeps them from being read
  aloud.

`search_help` returns its articles as one markdown string, so on voice it is clipped to 200
characters. The voice plan's "titles and a one-line summary on voice" is not built yet:
[COLLAB-19](./backlog/collaboration.md).

## Logging

One line per request: `[assistant-api] request { route, tool, channel, userId, auth_ms, session,
session_ms, tool_ms, status, total_ms }`. `userId` is `public.users.id`. `session` is `minted`,
`reused`, or `retried` (minted again after a 401). `session_ms` covers getting the session and
`authenticateToken`. Refusals add one line with the reason.
No line carries the input, the output, the email, the assertion or any token. The test harness
checks this after every scenario.

## Secrets and environment

| Name | Where | Notes |
|---|---|---|
| `ASSISTANT_API_SECRET` | function secret | the HS256 key; the assistant team gives the value. Unset means every request is 500 |
| `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | provided by Supabase | |
| `ANTHROPIC_API_KEY` | project secret, already set for ai-chat | `orchestrator.ts` constructs the SDK client at import; this function never calls it |

`config.toml` sets `verify_jwt = false`. The caller has no Supabase JWT, and the assertion is the
gate.

## Deploying to the dev project

Only to LandmarkDev (`nxvbglegqcgxlxvyfuht`). Never link, deploy to or run SQL against production
until the release is decided.

```sh
supabase link --project-ref nxvbglegqcgxlxvyfuht
supabase secrets set ASSISTANT_API_SECRET=<the value the assistant team gives you>
supabase functions deploy assistant-api
```

**Before the first live test:** in the dashboard, open Auth → Rate Limits → *token verifications*
on the dev project and check it. A session is minted, with one `/verify` request to GoTrue, once
per user per 5 minutes per warm isolate, no longer on every call. The limit is per IP. When it is
hit, session minting fails and the request is `500 internal_error`, with `verifyOtp failed` in the
log. Tracked as [SEC-A14](./backlog/security.md).

**Then run the smoke test** (`scripts/assistant-api-smoke.mjs`). It signs assertions as the
assistant does and checks the manifest, the pilot's mapping and role, one read on voice, and three
refusals. It writes nothing, refuses production, and never prints the secret or the email:

```sh
read -rs ASSISTANT_API_SECRET && export ASSISTANT_API_SECRET   # paste, Enter; stays out of history
ASSISTANT_API_EMAIL=<pilot's email> npm run assistant:smoke
```

Every check should read `PASS`. Send the manifest `version` it prints along with the URL.

Then give the assistant side:

1. the URL: `https://nxvbglegqcgxlxvyfuht.supabase.co/functions/v1/assistant-api`
2. the `/manifest` JSON, or let it pull the manifest with the secret
3. confirmation that the pilot Director's email is in that project's `public.users`, with the
   Director role and an `auth_user_id`
