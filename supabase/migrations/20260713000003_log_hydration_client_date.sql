-- log_hydration previously stamped rows with CURRENT_DATE (UTC), so hydration
-- landed on the wrong calendar day for users whose local day differs from UTC.
-- Accept the client's local day (p_log_date) so the write matches the local-day
-- read in src/services/hydration.ts (fetchHydrationToday). Falls back to
-- CURRENT_DATE when the caller omits it, so it stays backward-compatible.
--
-- Dropping the old 2-arg function first avoids an ambiguous overload.
DROP FUNCTION IF EXISTS log_hydration(NUMERIC, NUMERIC);

CREATE OR REPLACE FUNCTION log_hydration(
  p_ounces NUMERIC,
  p_target_oz NUMERIC DEFAULT 80,
  p_log_date DATE DEFAULT NULL
)
RETURNS hydration_log
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  result hydration_log;
  v_day DATE := COALESCE(p_log_date, CURRENT_DATE);
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  INSERT INTO hydration_log (user_id, logged_on, ounces, target_oz)
  VALUES (auth.uid(), v_day, GREATEST(0, p_ounces), p_target_oz)
  ON CONFLICT (user_id, logged_on)
  DO UPDATE SET ounces = GREATEST(0, hydration_log.ounces + p_ounces)
  RETURNING * INTO result;

  RETURN result;
END;
$$;

REVOKE EXECUTE ON FUNCTION log_hydration(NUMERIC, NUMERIC, DATE) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION log_hydration(NUMERIC, NUMERIC, DATE) TO authenticated;
