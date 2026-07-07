-- 018_hydration.sql
-- Hydration log — tap-to-log water intake. Feeds the Home fuel card and
-- gives the weather coach's heat-day hydration advice something to point at.
-- One row per user per day, incremented in place (not one row per tap).

CREATE TABLE hydration_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  logged_on   DATE NOT NULL DEFAULT CURRENT_DATE,
  ounces      NUMERIC(6,1) NOT NULL DEFAULT 0,
  target_oz   NUMERIC(6,1) NOT NULL DEFAULT 80,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, logged_on)
);

CREATE INDEX idx_hydration_log_user ON hydration_log(user_id, logged_on DESC);

CREATE TRIGGER hydration_log_updated_at BEFORE UPDATE ON hydration_log
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE hydration_log ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON hydration_log TO authenticated;
GRANT ALL ON hydration_log TO service_role;

CREATE POLICY hydration_log_self ON hydration_log
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Adds a fixed amount to today's row, creating it with the user's target if
-- it doesn't exist yet. Avoids a read-then-write race across quick taps.
--
-- p_logged_on defaults to CURRENT_DATE (Postgres server/UTC date) but the
-- client always passes its own local date explicitly — without that, a
-- user west of UTC would have their hydration ring reset at UTC midnight
-- (mid-evening local time) instead of their own midnight, since the
-- client-side "today" and this default would otherwise disagree.
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
