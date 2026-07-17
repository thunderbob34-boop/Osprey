-- 20260717000002_ozzie_chat_service_role_grants.sql
-- HOTFIX (applied live 2026-07-17, minutes after the chat go-live): the threads
-- migration (20260717000001) granted `authenticated` (the browser) but nothing
-- to service_role (the edge function). In THIS project service_role is NOT
-- covered by default privileges on new tables — 20260628000008 exists precisely
-- because of that ("service_role bypasses RLS but still needs base table
-- GRANTs") — so ozzie-chat's ownership SELECT failed with permission denied,
-- which its .maybeSingle() surfaced as a 404 "Conversation not found": every
-- send was dead on arrival. Caught by the first logged-in smoke test.
-- House pattern (008): GRANT ALL to service_role.

GRANT ALL ON ozzie_conversations TO service_role;
GRANT ALL ON ozzie_messages TO service_role;
