-- 030_ozzie_insights_delete_grant.sql
-- The client now clears today's cached daily brief (ozzie_insights,
-- insight_type='daily_brief') when a session is swapped/compressed/moved
-- indoors, so a stale brief describing the pre-adjustment session doesn't
-- keep outranking the freshly-updated training_sessions.ozzie_notes. The
-- existing ozzie_insights_self RLS policy (001) already covers DELETE for
-- the caller's own rows — 002 only ever granted SELECT/INSERT at the table
-- level, since nothing needed to delete from this table before.
GRANT DELETE ON ozzie_insights TO authenticated;
