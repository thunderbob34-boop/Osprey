-- 20260717000001_ozzie_chat_threads.sql
-- Ozzie chat (webapp): saved conversation threads.
--
-- The ozzie-chat edge function writes BOTH turns with the service-role key (the
-- house pattern — see ozzie-nutrition-coach/index.ts:300), so it needs no grant
-- here. `authenticated` gets only what the browser does directly: list and start
-- threads, and read their messages.
--
-- Additive and independent of the pending coaching deploy bundle: no existing
-- table, enum, view, or function is touched.

CREATE TABLE ozzie_conversations (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title      TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- The thread list is always "mine, newest activity first".
CREATE INDEX idx_ozzie_conversations_user ON ozzie_conversations(user_id, updated_at DESC);

CREATE TABLE ozzie_messages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES ozzie_conversations(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role            TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content         TEXT NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- Reading a thread is always "this conversation, oldest first".
CREATE INDEX idx_ozzie_messages_conversation ON ozzie_messages(conversation_id, created_at);

ALTER TABLE ozzie_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE ozzie_messages ENABLE ROW LEVEL SECURITY;

-- user_id is denormalised onto ozzie_messages so its policy is the same simple
-- self-check every other table uses, rather than a join through the parent.
-- FOR ALL by default; an omitted WITH CHECK reuses the USING expression, so one
-- policy covers the client's reads and its INSERT (precedent: user_recipes_self
-- in 20260713000002_recipes_and_web_nutrition_grants.sql).
CREATE POLICY ozzie_conversations_self ON ozzie_conversations
  USING (user_id = auth.uid());

CREATE POLICY ozzie_messages_self ON ozzie_messages
  USING (user_id = auth.uid());

-- RLS restricts rows; it does not substitute for base grants (see
-- 20260712000033_exercise_sets_write_grants.sql for the precedent).
GRANT SELECT, INSERT ON ozzie_conversations TO authenticated;
GRANT SELECT ON ozzie_messages TO authenticated;

-- TRUNCATE is not governed by RLS. New tables inherit Postgres's default
-- "grant all on create" TRUNCATE for anon/authenticated; revoke it to match the
-- convention established in 20260710000032_revoke_truncate_grants.sql.
REVOKE TRUNCATE ON ozzie_conversations, ozzie_messages FROM anon, authenticated;
