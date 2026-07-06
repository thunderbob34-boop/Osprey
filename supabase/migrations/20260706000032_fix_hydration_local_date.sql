-- 032_fix_hydration_local_date.sql
-- log_hydration always wrote against CURRENT_DATE, which on Supabase Postgres
-- is the UTC date, while the client displayed/queried using local device time.
-- For any non-UTC user the two dates disagree for part of the day (e.g. a
-- 6-8pm US log lands on "tomorrow" server-side while the UI still says
-- "today"), so today's hydration total appears to reset or vanish mid-evening.
-- Let the client pass its own local calendar date instead of trusting the
-- server's clock for a concept ("my day") that's inherently device-local.

-- CREATE OR REPLACE can't replace the old 2-arg overload (different signature) —
-- drop it explicitly so the two don't coexist.
DROP FUNCTION IF EXISTS log_hydration(NUMERIC, NUMERIC);

CREATE OR REPLACE FUNCTION log_hydration(
  p_ounces NUMERIC,
  p_target_oz NUMERIC DEFAULT 80,
  p_logged_on DATE DEFAULT CURRENT_DATE
)
RETURNS hydration_log
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  result hydration_log;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  INSERT INTO hydration_log (user_id, logged_on, ounces, target_oz)
  VALUES (auth.uid(), p_logged_on, GREATEST(0, p_ounces), p_target_oz)
  ON CONFLICT (user_id, logged_on)
  DO UPDATE SET ounces = GREATEST(0, hydration_log.ounces + p_ounces)
  RETURNING * INTO result;

  RETURN result;
END;
$$;

REVOKE EXECUTE ON FUNCTION log_hydration(NUMERIC, NUMERIC, DATE) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION log_hydration(NUMERIC, NUMERIC, DATE) TO authenticated;
