-- 017_physique_and_verified.sql
--
-- Two features:
--
-- 1. "Look + Function" physique coaching — adds a physique-goal axis
--    (cut / maintain / lean_bulk) alongside the existing performance goal,
--    plus a progress_photos table and a private storage bucket for
--    progress-photo capture. Ozzie's nutrition coach reads these to phase
--    physique and performance goals against each other (e.g. hold calories
--    at maintenance during race week even mid-cut).
--
-- 2. "Verified effort" — a trust layer for challenge leaderboards. Adds a
--    workout_logs.verified flag that clients cannot set directly (trigger
--    guard); it is only granted by verify_workout_effort(), a SECURITY
--    DEFINER plausibility check run server-side against the workout's GPS
--    track. get_challenge_leaderboard gains a verified-only mode.

-- ── 1a. Physique goal on user_goals ─────────────────────────────────────────

ALTER TABLE user_goals
  ADD COLUMN IF NOT EXISTS physique_goal TEXT
    CHECK (physique_goal IN ('cut', 'maintain', 'lean_bulk')),
  ADD COLUMN IF NOT EXISTS physique_target_date DATE;

-- ── 1b. Progress photos ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS progress_photos (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  taken_on     DATE NOT NULL DEFAULT CURRENT_DATE,
  storage_path TEXT NOT NULL,
  weight_kg    NUMERIC(5,2),
  note         TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_progress_photos_user
  ON progress_photos(user_id, taken_on DESC);

ALTER TABLE progress_photos ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, DELETE ON progress_photos TO authenticated;
GRANT ALL ON progress_photos TO service_role;

CREATE POLICY progress_photos_owner ON progress_photos
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Private storage bucket; each user may only touch objects under their own
-- <user_id>/ prefix. Wrapped in a DO block because storage.objects policy
-- creation requires elevated privileges on some Supabase setups — if this
-- block is skipped, create the same policy from Dashboard → Storage → Policies.
INSERT INTO storage.buckets (id, name, public)
VALUES ('progress-photos', 'progress-photos', false)
ON CONFLICT (id) DO NOTHING;

DO $$
BEGIN
  CREATE POLICY progress_photos_storage_owner ON storage.objects
    FOR ALL TO authenticated
    USING (
      bucket_id = 'progress-photos'
      AND (storage.foldername(name))[1] = auth.uid()::text
    )
    WITH CHECK (
      bucket_id = 'progress-photos'
      AND (storage.foldername(name))[1] = auth.uid()::text
    );
EXCEPTION
  WHEN insufficient_privilege THEN
    RAISE NOTICE 'Could not create storage.objects policy — add it manually in the Supabase Dashboard (Storage → progress-photos → Policies).';
  WHEN duplicate_object THEN
    NULL; -- policy already exists
END;
$$;

-- ── 2a. verified flag, guarded against direct client writes ─────────────────

ALTER TABLE workout_logs
  ADD COLUMN IF NOT EXISTS verified BOOLEAN NOT NULL DEFAULT FALSE;

-- Clients hold UPDATE on workout_logs under self-only RLS, so without a
-- guard anyone could UPDATE their own row to verified = TRUE and defeat the
-- whole point. The trigger silently discards any change to `verified` unless
-- the transaction-local flag set by verify_workout_effort() is present.
CREATE OR REPLACE FUNCTION guard_workout_verified()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF current_setting('osprey.verifying', true) IS DISTINCT FROM 'on' THEN
    IF TG_OP = 'INSERT' THEN
      NEW.verified := FALSE;
    ELSIF NEW.verified IS DISTINCT FROM OLD.verified THEN
      NEW.verified := OLD.verified;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_workout_verified ON workout_logs;
CREATE TRIGGER trg_guard_workout_verified
  BEFORE INSERT OR UPDATE ON workout_logs
  FOR EACH ROW
  EXECUTE FUNCTION guard_workout_verified();

-- ── 2b. Server-side plausibility check ──────────────────────────────────────

-- v1 heuristic for GPS-tracked runs/races:
--   · average speed within human range (0.5–6.5 m/s; marathon WR ≈ 5.7 m/s)
--   · at least ~1 GPS fix per 100 m of claimed distance (min 10 fixes)
--   · no single fix faster than 12 m/s (flat-out sprint)
-- Non-GPS workouts (lift, manual entries) simply stay unverified — that
-- means "unverifiable", not "cheating".
CREATE OR REPLACE FUNCTION verify_workout_effort(p_workout_id UUID)
RETURNS BOOLEAN
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  wl          workout_logs%ROWTYPE;
  point_count INTEGER := 0;
  max_speed   NUMERIC := 0;
  avg_speed   NUMERIC;
  plausible   BOOLEAN := FALSE;
BEGIN
  SELECT * INTO wl
  FROM workout_logs
  WHERE id = p_workout_id
    AND user_id = auth.uid()   -- callers may only verify their own workouts
    AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  IF wl.session_type IN ('run', 'race')
     AND wl.total_distance_km IS NOT NULL
     AND wl.total_duration_s IS NOT NULL
     AND wl.total_duration_s > 0 THEN

    avg_speed := (wl.total_distance_km * 1000.0) / wl.total_duration_s;

    SELECT COUNT(*), COALESCE(MAX(speed_ms), 0)
    INTO point_count, max_speed
    FROM activity_logs
    WHERE workout_id = p_workout_id;

    plausible :=
      avg_speed BETWEEN 0.5 AND 6.5
      AND point_count >= GREATEST(10, FLOOR(wl.total_distance_km * 10))
      AND max_speed <= 12;
  END IF;

  IF plausible THEN
    PERFORM set_config('osprey.verifying', 'on', true);
    UPDATE workout_logs SET verified = TRUE WHERE id = p_workout_id;
    PERFORM set_config('osprey.verifying', 'off', true);
  END IF;

  RETURN plausible;
END;
$$;

GRANT EXECUTE ON FUNCTION verify_workout_effort(UUID) TO authenticated;

-- ── 2c. Leaderboard verified-only mode ──────────────────────────────────────

DROP FUNCTION IF EXISTS get_challenge_leaderboard(UUID);
CREATE OR REPLACE FUNCTION get_challenge_leaderboard(
  p_challenge_id  UUID,
  p_verified_only BOOLEAN DEFAULT FALSE
)
RETURNS TABLE(
  user_id       UUID,
  display_name  TEXT,
  value         NUMERIC,
  rank          BIGINT
)
SECURITY DEFINER
SET search_path = public
LANGUAGE sql
STABLE
AS $$
  WITH challenge_info AS (
    SELECT c.type, c.starts_on, c.ends_on
    FROM challenges c
    WHERE c.id = p_challenge_id
      AND c.deleted_at IS NULL
      -- Security: only return data if caller is a member or creator
      AND (
        c.creator_user_id = auth.uid()
        OR is_challenge_member(p_challenge_id, auth.uid())
      )
  ),
  members AS (
    SELECT cm.user_id, u.display_name
    FROM challenge_members cm
    JOIN users u ON u.id = cm.user_id
    WHERE cm.challenge_id = p_challenge_id
      -- Only populate once the caller has passed the challenge_info gate above.
      AND EXISTS (SELECT 1 FROM challenge_info)
  ),
  scores AS (
    SELECT
      m.user_id,
      m.display_name,
      CASE (SELECT type FROM challenge_info)
        WHEN 'mileage'  THEN COALESCE(
          SUM(wl.total_distance_km) FILTER (WHERE wl.total_distance_km IS NOT NULL) / 1.609344,
          0
        )
        WHEN 'workouts' THEN COALESCE(COUNT(wl.id)::NUMERIC, 0)
        WHEN 'duration' THEN COALESCE(
          SUM(wl.total_duration_s) FILTER (WHERE wl.total_duration_s IS NOT NULL) / 60.0,
          0
        )
        ELSE 0
      END AS value
    FROM members m
    LEFT JOIN workout_logs wl
      ON  wl.user_id    = m.user_id
      AND wl.started_at::DATE >= (SELECT starts_on FROM challenge_info)
      AND wl.started_at::DATE <= (SELECT ends_on   FROM challenge_info)
      AND wl.status IN ('completed', 'partial')
      AND wl.deleted_at IS NULL
      AND (NOT p_verified_only OR wl.verified)
    GROUP BY m.user_id, m.display_name
  )
  SELECT
    s.user_id,
    s.display_name,
    ROUND(s.value, 1) AS value,
    RANK() OVER (ORDER BY s.value DESC) AS rank
  FROM scores s
  ORDER BY rank, s.display_name;
$$;

GRANT EXECUTE ON FUNCTION get_challenge_leaderboard(UUID, BOOLEAN) TO authenticated;
