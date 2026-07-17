# Webapp Ozzie Chat — grounded, streaming, saved threads — Design

**Date:** 2026-07-17
**Status:** Approved (design) — ready for implementation plan
**Origin:** "Phase 3" of the original webapp design spec (`docs/superpowers/specs/2026-07-12-osprey-webapp-phase1-design.md`), never started. 4th slice of the "make the webapp a real product" program (all-sports coverage + plan editing + home dashboard shipped and pushed; main `5cfae66`).

A two-way coaching chat at `/chat`: you ask, Ozzie answers **grounded in your real plan**, replies **stream** in word-by-word, and threads are **saved** so you can revisit them.

**Nothing exists to reuse.** The phone's `app/ask-ozzie.tsx` is a placeholder that says two-way chat "aren't live yet" and redirects to "Why this session?". There is no `ozzie-chat` function and no conversation table. This is net-new — and the webapp is the right home for it (conversation wants a keyboard and a big screen).

---

## Global Constraints

- **This slice touches the backend** — unlike the previous three webapp slices. It adds **one migration** (two tables) and **one edge function**. Both are **additive and independent of the held coaching bundle** (they touch no existing table, enum, or function), so they can deploy standalone without triggering the coaching go-live. **Chat is dark until they deploy.**
- **The chat function is the first streaming Ozzie function.** The other eight return JSON; `ozzie-chat` returns `text/event-stream`. This is the slice's main technical risk.
- **The OpenAI key stays server-side.** Auth mirrors `supabase/functions/ozzie-nutrition-coach/index.ts:295-302`: require an `Authorization` header → `supabase.auth.getUser(token)` → 401 if absent/invalid. The function is never an open proxy.
- **Do NOT read `goal_params`** in the chat function's context builder — that column is in the pending-undeployed bundle, and reading it would make chat depend on that deploy (the exact trap the home dashboard's final review caught). Read only already-deployed objects. **Verified against the live schema on 2026-07-17:** `user_goals` in production has `primary_goal, target_race, target_date, weekly_run_days, weekly_lift_days, fitness_level, total_weeks_planned, threshold_anchor` — and **no `goal_params`**. Selecting it would 400 every chat call.
- **Existing 118 webapp tests stay green.** Commands: webapp `cd webapp && npm test` (vitest, `TZ=America/New_York`), `npm run typecheck`, `npm run build`; edge `deno test supabase/functions/ozzie-chat/`.
- **TDD** for the function's pure builders and the webapp's pure helpers. The streaming path and the UI are typecheck + build + preview.

---

## 1. Schema — migration `20260717000001_ozzie_chat_threads.sql`

Mirrors the house pattern (`20260713000002_recipes_and_web_nutrition_grants.sql`): `user_id` FK → `users(id) ON DELETE CASCADE`, RLS enabled, a `<table>_self` policy, full CRUD grant to `authenticated`.

```sql
CREATE TABLE ozzie_conversations (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title      TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_ozzie_conversations_user ON ozzie_conversations(user_id, updated_at DESC);

CREATE TABLE ozzie_messages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES ozzie_conversations(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role            TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content         TEXT NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_ozzie_messages_conversation ON ozzie_messages(conversation_id, created_at);
```
plus `ENABLE ROW LEVEL SECURITY` and `ozzie_conversations_self` / `ozzie_messages_self` policies (`USING (user_id = auth.uid())`) — `FOR ALL` by default, and per the `user_recipes_self` precedent an omitted `WITH CHECK` reuses the `USING` expression, so one policy covers the client's reads and its INSERT.

Grants are least-privilege, because **the function writes as service-role and needs no grant at all**. `authenticated` gets only what the browser does directly:

```sql
GRANT SELECT, INSERT ON ozzie_conversations TO authenticated;  -- list threads, start one
GRANT SELECT ON ozzie_messages TO authenticated;               -- read history; the function writes both turns
REVOKE TRUNCATE ON ozzie_conversations, ozzie_messages FROM anon, authenticated;  -- per 20260710000032
```

`ozzie_messages.user_id` is denormalised deliberately so its RLS policy is the same simple `user_id = auth.uid()` every other table uses, rather than a join through `ozzie_conversations`. `ON DELETE CASCADE` on `conversation_id` means deleting a thread takes its messages.

## 2. Edge function `ozzie-chat` (new, streaming)

`POST { conversationId: string, message: string, clientDate: string }` → `text/event-stream`.

0. **CORS — mandatory, and easy to miss.** `OPTIONS` → 200 with `Access-Control-Allow-Origin: *` and `Access-Control-Allow-Headers: authorization, x-client-info, apikey, content-type`; **every** response (including 401/404/500) carries the origin header. Copy `ozzie-race-briefing/index.ts:75-82` — the repo's only precedent. Six of the eight Ozzie functions omit CORS because the phone (React Native) doesn't enforce it, so the obvious template (`ozzie-nutrition-coach`) has none. A browser preflights any request carrying an `Authorization` header: without this, chat cannot work from the webapp at all.
1. **Auth** — `Authorization` header → `createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)` → `supabase.auth.getUser(token)`; 401 without a valid user. This is the house pattern — all eight existing functions use the **service-role** client and authenticate the caller separately. It follows that **RLS does not constrain anything this function does**: every query must be scoped by hand with `.eq('user_id', userId)`.
2. **Verify the thread is theirs** — `SELECT id FROM ozzie_conversations WHERE id = conversationId AND user_id = userId`; absent → 404. **This check is the only thing standing between a caller and a stranger's thread.** The service-role client bypasses RLS, and `ozzie_messages`'s policy would not save us anyway: it authorises *the row's owner*, not *which conversation the row lands in*. Never drop it.
3. **Persist the user turn** — `INSERT ozzie_messages (conversation_id, user_id, role:'user', content: message)`.
4. **Build context** — already-deployed objects only, each bounded so the prompt cannot grow without limit:
   - `user_goals`: `primary_goal`, `target_race`, `target_date`, `total_weeks_planned`, `threshold_anchor`. **Never `goal_params`.**
   - `training_sessions` for the current week — Mon–Sun derived from the client-sent `clientDate`. The function has no local clock and must not guess the athlete's timezone. `ozzie-nutrition-coach` already establishes this exact pattern (`index.ts:310-325`: a `clientDate` body param with a UTC fallback and a comment explaining why); the webapp computes the value with `toDateInputValue` (`webapp/src/lib/day.ts`). A client sending a wrong date only mis-scopes its own context.
   - the **10 most recent** `workout_logs`.
   - `v_daily_summary` (recovery, TSB) via `.maybeSingle()`.
5. **Build the thread** — the conversation's **last 20** `ozzie_messages` by `created_at` (10 exchanges — enough for continuity, bounded for cost), re-ordered oldest-first, mapped to OpenAI `{ role, content }`, prefixed by the system prompt (§4).
6. **Call the model** — `fetch('https://api.openai.com/v1/chat/completions')`, `Bearer ${Deno.env.get('OPENAI_API_KEY')}`, `model: 'gpt-4o-mini'`, `stream: true` (matching the model + key handling of the other Ozzie functions).
7. **Stream + persist** — pipe the model's SSE chunks to the client while assembling the full text; on completion `INSERT ozzie_messages (role:'assistant', content: assembled)` and touch `ozzie_conversations.updated_at`. **The server owns the record**, so a dropped client connection cannot lose the reply.

## 3. Webapp `/chat`

- **Route** `webapp/src/routes/_authed/chat.tsx`; a `{ to: '/chat', label: 'Ask Ozzie' }` entry in `webapp/src/components/NavRail.tsx`'s `links` array.
- **`webapp/src/features/chat/queries.ts`** — `useConversations(userId)` (list, `updated_at DESC`), `useMessages(conversationId)` (ordered), `useCreateConversation(userId)` (INSERT with a title derived from the first message).
- **`webapp/src/features/chat/send.ts`** — the streaming call. NOT React Query, and **not `supabase.functions.invoke`** (it buffers the whole response — it cannot stream): a raw `fetch` to `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ozzie-chat` with the session's access token and the local `clientDate`, reading the `ReadableStream`, decoding SSE chunks, and handing each token to a callback. On completion, invalidate `['messages', conversationId]` + `['conversations', userId]` (the function already persisted both turns).
- **Send flow.** "+ New chat" clears the active thread rather than writing a row — an empty thread never reaches the database. On a send with no active thread: `INSERT ozzie_conversations` with `title: titleFromFirstMessage(message)`, then POST to the function with the new id; subsequent sends reuse the active id. The composer caps input at **2000 characters** and disables Send on empty/whitespace.
- **UI** (per the approved mockup): thread list left (`+ New chat`, saved threads, active highlighted), conversation right (user + Ozzie bubbles, the streaming reply with a cursor), composer bottom. Reuse the existing `app.css` idioms (`.ozzie-note`-style Ozzie bubbles, `.btn`, `.detail-card`, `.rail-link`) — no new CSS rules; inline styles are fine.
- **Pure helper** `titleFromFirstMessage(text: string): string` — trim + collapse whitespace, cut to ~48 chars on a word boundary, fall back to "New chat".

## 4. Grounding + safety (the system prompt)

- **Grounded, not generic:** the prompt carries the athlete's goal, phase, zones, this week's sessions, and recent logs, and instructs Ozzie to answer from them (cite the actual session/pace/phase) rather than give textbook advice.
- **Coaching scope with a safety line:** people will ask "my knee hurts — should I run?". The prompt keeps Ozzie in training/fuelling territory and, for pain, injury, or medical questions, has it say so plainly and point to a professional rather than diagnose or prescribe treatment.
- **Advice, not action:** Ozzie can say "move Tuesday to Wednesday"; it does not edit the plan. Edits happen on the calendar (the plan-editing slice). Chat may link there.
- Voice matches the repo's copy rule (CLAUDE.md): athlete-facing, plain language.

## 5. Error / edge cases

- No `OPENAI_API_KEY`, or the model call fails → the function returns a non-2xx before opening the stream; the UI shows an inline error and the user's message stays in the thread (already persisted) so they can retry.
- Stream drops mid-reply → the client shows what arrived plus a retry affordance; the server-side persist on completion never ran, so the thread has the question without an answer (honest, not a phantom half-reply).
- A brand-new user with no plan → context is thin; the prompt says so and Ozzie answers generally rather than inventing a plan.
- Empty/whitespace message → the composer's Send is disabled.

## 6. Testing

- **Edge (Deno, TDD where pure):** everything pure lives outside `index.ts` so it is testable, mirroring `ozzie-generate-plan`'s `index.ts`/`validate.ts` split. `context.ts` — the context shaper, the system-prompt builder (asserting the safety line and the grounding data are present), and the thread mapper (ordered oldest-first, roles correct, capped at 20). `stream.ts` — the SSE chunk parser (an OpenAI `data:` line → token text, `[DONE]` and partial-line handling). `index.ts` is the impure handler (auth, ownership check, persists, the network stream) and is exercised manually, not unit-tested.
- **Webapp:** `titleFromFirstMessage` unit tests; the queries/streaming client are typecheck-verified (Supabase/network-hitting, as with every other hook); the page is typecheck + build + a preview smoke.
- Existing **118 webapp tests stay green**; `deno check` stays at its 26-error `@supabase/supabase-js` baseline.

## Non-goals (deferred follow-ups)

**`coach_memory` as context** — a live table (`20260703000026`) the phone writes on PRs/races and `ozzie-daily-brief` already reads; it would make Ozzie remember milestones, but it is empty in the dev database (unverifiable here) and outside the approved design. The natural next enrichment. TTS/voice playback (`ozzie_insights.tts_audio_url` exists but is out of scope); replacing the phone's Ask-Ozzie stub (this is webapp-first — the phone can adopt the same function later); Ozzie *acting* on the plan (advice only); thread rename/delete; attachments/images; sharing a thread; a contextual "ask about this session" launcher from the calendar; message-level retry/edit.

---

## File-by-file change map

**Migration:** `supabase/migrations/20260717000001_ozzie_chat_threads.sql` — **new.** The two tables + indexes + RLS + grants.

**Edge (`supabase/functions/ozzie-chat/`):** — **new.**
- `index.ts` — the impure handler: auth, the thread-ownership check, persist-user-turn, the streaming model call, persist-assistant-turn.
- `context.ts` — **pure.** The context shaper, the system-prompt builder, the thread mapper.
- `stream.ts` — **pure.** The SSE chunk parser.
- `context.test.ts`, `stream.test.ts` — the pure-builder tests (house naming: `*.test.ts`, per `ozzie-generate-plan/validate.test.ts`).

**Webapp (`webapp/`):**
- `src/routes/_authed/chat.tsx` — **new.** The page (thread list + conversation + composer).
- `src/features/chat/queries.ts` — **new.** `useConversations`, `useMessages`, `useCreateConversation`.
- `src/features/chat/send.ts` — **new.** The streaming client.
- `src/features/chat/model.ts` — **new.** `titleFromFirstMessage`.
- `src/components/NavRail.tsx` — add the `/chat` link.
- `tests/chat-model.test.ts` — **new.**

---

## Testing & acceptance criteria

1. `/chat` is reachable from the nav rail; "+ New chat" starts a thread; sending a message shows it immediately and streams Ozzie's reply in word-by-word.
2. Replies are **grounded**: they reference the athlete's actual session/pace/phase, not generic advice.
3. Reloading the page shows the same threads and their full history (both turns persisted server-side).
4. A pain/injury/medical question gets a plain-language "see a professional" answer, not a diagnosis.
5. The chat function answers `OPTIONS` with CORS headers (without them the browser blocks every call before it reaches the handler), returns 401 without a valid JWT, 404 for a thread the caller doesn't own, and never selects `goal_params`.
6. The migration + function are additive and independent — applying them does not touch the pending coaching bundle. Existing 118 webapp tests stay green; typecheck + build clean.
