-- 033_exercise_sets_write_grants.sql
-- The webapp's strength-logging sets grid (webapp/src/features/grid) edits and deletes
-- individual exercise_sets rows in place — editing an existing set after reload, or
-- removing one entirely. The exercise_sets_via_workout RLS policy already covers ALL
-- commands (SELECT/INSERT/UPDATE/DELETE) scoped to the caller's own workout_logs, but
-- the table itself was only ever granted SELECT/INSERT at the table level, since nothing
-- needed to update or delete a set before now. Confirmed live 2026-07-12: attempting a
-- DELETE returns Postgres error 42501 "permission denied for table exercise_sets" even
-- though RLS would allow it — RLS restricts rows, it doesn't substitute for the base grant.
GRANT UPDATE, DELETE ON exercise_sets TO authenticated;
