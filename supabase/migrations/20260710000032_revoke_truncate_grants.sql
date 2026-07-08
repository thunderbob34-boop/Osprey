-- ============================================================
-- OSPREY 032 — Revoke TRUNCATE from anon/authenticated
-- Every public table was left with Postgres's default "grant all on
-- create" privileges, which includes TRUNCATE for both anon and
-- authenticated. RLS policies don't govern TRUNCATE at all, so this
-- was the one operation those policies could never have stopped.
-- Not reachable through the app's normal path (PostgREST only issues
-- SELECT/INSERT/UPDATE/DELETE over HTTP), but a raw Postgres
-- connection with either role's credentials could wipe any table.
-- Revoking it is pure defense-in-depth cleanup, no behavior change
-- for the app.
-- ============================================================

DO $$
DECLARE
  t text;
BEGIN
  FOR t IN
    SELECT c.relname
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r'
  LOOP
    EXECUTE format('REVOKE TRUNCATE ON TABLE public.%I FROM anon, authenticated;', t);
  END LOOP;
END $$;
