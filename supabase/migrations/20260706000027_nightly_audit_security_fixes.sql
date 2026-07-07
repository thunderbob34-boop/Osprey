-- 027_nightly_audit_security_fixes.sql
-- Nightly audit 2026-07-06.
--
-- 1. challenges_read / challenge_members_read both subqueried
--    challenge_members from inside their own RLS policy. Postgres re-applies
--    RLS to any table read inside a policy body, so challenge_members'
--    policy ends up evaluating itself — "infinite recursion detected in
--    policy" (42P17) on every SELECT against either table. The entire
--    challenges feature was down. Fixed by moving the membership check into
--    a SECURITY DEFINER helper, which (as the function owner) reads
--    challenge_members without going back through its RLS policy.
--
-- 2. get_my_friends / get_friends_at_race accepted a caller-supplied
--    p_user_id with no check that it matched the caller. Any authenticated
--    user could enumerate any other user's accepted friends and race
--    schedule by passing a victim's UUID. Both now ignore the parameter and
--    read the caller's identity from auth.uid() directly.
--
-- 3. get_race_partners(p_race_id) had no ownership check at all — any
--    authenticated user could list the partners on any race by id. Added a
--    check that the caller owns the race.
--
-- 4. get_challenge_leaderboard gated only the `challenge_info` CTE on
--    membership; `members` (and everything downstream) queried
--    challenge_members directly and was never actually restricted by that
--    gate, so a non-member calling with any valid challenge id got the full
--    member list back (scored 0, but names + UUIDs were real). Fixed by
--    cross-joining `members` through `challenge_info`, so a caller who fails
--    the membership check gets zero rows back, not just zero scores.
--
-- 5. activity_shares_self / kudos_self were both commented "own + friends
--    can read" but only ever implemented "own" (`user_id = auth.uid()` /
--    `from_user = auth.uid()`, no FOR clause so it applied to every
--    command). The friends activity feed was therefore structurally
--    self-only regardless of the query bug fixed in activity.ts above, and
--    kudo counts could never reflect anyone but the viewer. Split each into
--    per-command policies and added accepted-friendship visibility to the
--    SELECT policies; writes remain restricted to the row's own user.
--
-- 6. coach_memory's two dedupe indexes were PARTIAL unique indexes
--    (`WHERE workout_id IS NOT NULL` / `WHERE race_id IS NOT NULL`).
--    Postgres will not use a partial index as a plain `ON CONFLICT (cols)`
--    target unless the same WHERE predicate is repeated in the statement,
--    which supabase-js's `.upsert(..., { onConflict: '...' })` never does —
--    so both upsert call sites (races.ts, workouts.ts) failed with 42P10 on
--    every call, silently swallowed, and coach_memory was never populated.
--    Dropped the WHERE clause: NULLs are still never-equal under a plain
--    unique index, so behavior for NULL workout_id/race_id rows is
--    unchanged, but the index is now non-partial and usable as a conflict
--    target.
--
-- 7. get_activity_feed (the RPC activity.ts's primary path calls) didn't
--    exist anywhere, so every call fell through to a client-side fallback
--    query — which was itself broken (see the activity.ts diff) and, even
--    fixed, can never surface friends' shares: activity_shares' RLS now
--    allows friend reads (fix 5 above), but the fallback embeds `users` and
--    `workout_logs` via `!inner`, and both of THOSE tables are self-only —
--    the inner join silently drops any row the viewer doesn't own. Added
--    the RPC as SECURITY DEFINER so it can read across users/workout_logs
--    for accepted friends, matching the client's existing call signature
--    exactly (no app-code change needed).
--
-- 8. log_hydration's p_logged_on parameter (see hydration.ts / 018) is
--    re-declared here defensively via CREATE OR REPLACE, in case 018 was
--    already applied somewhere before this audit — CREATE OR REPLACE is
--    idempotent, so this is a no-op if 018 deploys with the fix directly.

-- ── 1. RLS recursion fix ────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION is_challenge_member(p_challenge_id UUID, p_user_id UUID)
RETURNS BOOLEAN
SECURITY DEFINER
SET search_path = public
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM challenge_members
    WHERE challenge_id = p_challenge_id AND user_id = p_user_id
  );
$$;

GRANT EXECUTE ON FUNCTION is_challenge_member TO authenticated;

DROP POLICY IF EXISTS challenges_read ON challenges;
CREATE POLICY challenges_read ON challenges
  FOR SELECT TO authenticated
  USING (
    creator_user_id = auth.uid()
    OR is_challenge_member(id, auth.uid())
  );

DROP POLICY IF EXISTS challenge_members_read ON challenge_members;
CREATE POLICY challenge_members_read ON challenge_members
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR is_challenge_member(challenge_id, auth.uid())
  );

-- ── 2. Friend RPC parameter-spoofing fix ────────────────────────────────────

CREATE OR REPLACE FUNCTION get_my_friends(p_user_id UUID)
RETURNS TABLE(friend_user_id UUID, friend_display_name TEXT)
SECURITY DEFINER
SET search_path = public
LANGUAGE sql
STABLE
AS $$
  SELECT
    u.id              AS friend_user_id,
    u.display_name    AS friend_display_name
  FROM friendships f
  JOIN users u ON u.id = CASE
    WHEN f.requester_id = auth.uid() THEN f.addressee_id
    ELSE f.requester_id
  END
  WHERE f.status = 'accepted'
    AND (f.requester_id = auth.uid() OR f.addressee_id = auth.uid())
    AND u.deleted_at IS NULL
  ORDER BY u.display_name;
$$;

CREATE OR REPLACE FUNCTION get_friends_at_race(
  p_user_id    UUID,
  p_event_date DATE
)
RETURNS TABLE(
  friend_user_id       UUID,
  friend_display_name  TEXT,
  friend_race_id       UUID,
  friend_race_name     TEXT
)
SECURITY DEFINER
SET search_path = public
LANGUAGE sql
STABLE
AS $$
  SELECT
    u.id              AS friend_user_id,
    u.display_name    AS friend_display_name,
    re.id             AS friend_race_id,
    re.name           AS friend_race_name
  FROM friendships f
  JOIN users u ON u.id = CASE
    WHEN f.requester_id = auth.uid() THEN f.addressee_id
    ELSE f.requester_id
  END
  JOIN race_events re
    ON  re.user_id    = u.id
    AND re.event_date = p_event_date
    AND re.deleted_at IS NULL
  WHERE f.status = 'accepted'
    AND (f.requester_id = auth.uid() OR f.addressee_id = auth.uid())
    AND u.deleted_at IS NULL
  ORDER BY u.display_name;
$$;

-- ── 3. get_race_partners ownership check ────────────────────────────────────

CREATE OR REPLACE FUNCTION get_race_partners(p_race_id UUID)
RETURNS TABLE(
  partner_user_id       UUID,
  partner_display_name  TEXT
)
SECURITY DEFINER
SET search_path = public
LANGUAGE sql
STABLE
AS $$
  SELECT
    rp.partner_user_id,
    u.display_name AS partner_display_name
  FROM race_partners rp
  JOIN users u ON u.id = rp.partner_user_id
  WHERE rp.race_id = p_race_id
    AND EXISTS (
      SELECT 1 FROM race_events re
      WHERE re.id = p_race_id AND re.user_id = auth.uid() AND re.deleted_at IS NULL
    )
  ORDER BY u.display_name;
$$;

-- ── 4. get_challenge_leaderboard membership-gating fix ──────────────────────
-- Same function as 025_challenge_leaderboard_v2.sql, with `members` now
-- cross-joined through `challenge_info` so a failed membership check (empty
-- challenge_info) yields zero members, not just zero scores.

CREATE OR REPLACE FUNCTION get_challenge_leaderboard(p_challenge_id UUID)
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
        OR EXISTS (
          SELECT 1 FROM challenge_members
          WHERE challenge_id = p_challenge_id AND user_id = auth.uid()
        )
      )
  ),
  members AS (
    SELECT cm.user_id, u.display_name
    FROM challenge_members cm
    JOIN users u ON u.id = cm.user_id
    JOIN challenge_info ci ON TRUE
    WHERE cm.challenge_id = p_challenge_id
  ),
  lift_volumes AS (
    SELECT wl.user_id, SUM(es.weight_kg * es.reps) / 0.453592 AS volume_lbs
    FROM workout_logs wl
    JOIN exercise_sets es ON es.workout_id = wl.id
    JOIN challenge_info ci ON TRUE
    WHERE wl.session_type = 'lift'
      AND wl.started_at::DATE >= ci.starts_on
      AND wl.started_at::DATE <= ci.ends_on
      AND wl.status IN ('completed', 'partial')
      AND wl.deleted_at IS NULL
    GROUP BY wl.user_id
  ),
  active_days AS (
    SELECT DISTINCT wl.user_id, wl.started_at::DATE AS active_on
    FROM workout_logs wl
    JOIN challenge_info ci ON TRUE
    WHERE wl.started_at::DATE >= ci.starts_on
      AND wl.started_at::DATE <= ci.ends_on
      AND wl.status IN ('completed', 'partial')
      AND wl.deleted_at IS NULL
  ),
  streak_groups AS (
    SELECT
      user_id,
      active_on,
      active_on - (ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY active_on))::INT AS island
    FROM active_days
  ),
  streaks AS (
    SELECT user_id, COUNT(*) AS streak_len
    FROM streak_groups
    GROUP BY user_id, island
  ),
  best_streaks AS (
    SELECT user_id, MAX(streak_len) AS best_streak
    FROM streaks
    GROUP BY user_id
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
        WHEN 'lift_volume' THEN COALESCE(
          (SELECT lv.volume_lbs FROM lift_volumes lv WHERE lv.user_id = m.user_id),
          0
        )
        WHEN 'streak' THEN COALESCE(
          (SELECT bs.best_streak FROM best_streaks bs WHERE bs.user_id = m.user_id),
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

GRANT EXECUTE ON FUNCTION get_challenge_leaderboard TO authenticated;

-- ── 5. activity_shares / kudos friend-visibility fix ────────────────────────

DROP POLICY IF EXISTS activity_shares_self ON activity_shares;

CREATE POLICY activity_shares_read ON activity_shares
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM friendships f
      WHERE f.status = 'accepted'
        AND (
          (f.requester_id = auth.uid() AND f.addressee_id = activity_shares.user_id)
          OR (f.addressee_id = auth.uid() AND f.requester_id = activity_shares.user_id)
        )
    )
  );

CREATE POLICY activity_shares_insert ON activity_shares
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY activity_shares_update ON activity_shares
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY activity_shares_delete ON activity_shares
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS kudos_self ON kudos;

CREATE POLICY kudos_read ON kudos
  FOR SELECT TO authenticated
  USING (
    from_user = auth.uid()
    OR EXISTS (
      SELECT 1 FROM activity_shares s
      WHERE s.id = kudos.share_id
        AND (
          s.user_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM friendships f
            WHERE f.status = 'accepted'
              AND (
                (f.requester_id = auth.uid() AND f.addressee_id = s.user_id)
                OR (f.addressee_id = auth.uid() AND f.requester_id = s.user_id)
              )
          )
        )
    )
  );

CREATE POLICY kudos_insert ON kudos
  FOR INSERT TO authenticated
  WITH CHECK (from_user = auth.uid());

CREATE POLICY kudos_delete ON kudos
  FOR DELETE TO authenticated
  USING (from_user = auth.uid());

-- ── 6. coach_memory dedupe indexes — make non-partial so ON CONFLICT works ──

DROP INDEX IF EXISTS idx_coach_memory_workout_dedup;
CREATE UNIQUE INDEX idx_coach_memory_workout_dedup
  ON coach_memory(user_id, event_type, workout_id, exercise_id);

DROP INDEX IF EXISTS idx_coach_memory_race_dedup;
CREATE UNIQUE INDEX idx_coach_memory_race_dedup
  ON coach_memory(user_id, event_type, race_id);

-- ── 7. get_activity_feed — friend-aware activity feed RPC ───────────────────
-- p_user_id is accepted (matching activity.ts's existing call) but ignored
-- in favor of auth.uid(), same spoofing-resistant pattern as fix 2.

CREATE OR REPLACE FUNCTION get_activity_feed(p_user_id UUID, p_limit INT DEFAULT 50)
RETURNS TABLE(
  share_id           UUID,
  workout_id         UUID,
  user_id            UUID,
  display_name       TEXT,
  caption            TEXT,
  session_type       TEXT,
  total_duration_s   INTEGER,
  total_distance_km  NUMERIC,
  share_created_at   TIMESTAMPTZ,
  kudo_count         BIGINT,
  user_gave_kudo     BOOLEAN
)
SECURITY DEFINER
SET search_path = public
LANGUAGE sql
STABLE
AS $$
  SELECT
    s.id                    AS share_id,
    s.workout_id,
    s.user_id,
    u.display_name,
    s.caption,
    wl.session_type::TEXT   AS session_type,
    wl.total_duration_s,
    wl.total_distance_km,
    s.created_at            AS share_created_at,
    COUNT(k.id)              AS kudo_count,
    BOOL_OR(k.from_user = auth.uid()) AS user_gave_kudo
  FROM activity_shares s
  JOIN users u        ON u.id = s.user_id
  JOIN workout_logs wl ON wl.id = s.workout_id
  LEFT JOIN kudos k    ON k.share_id = s.id
  WHERE s.deleted_at IS NULL
    AND (
      s.user_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM friendships f
        WHERE f.status = 'accepted'
          AND (
            (f.requester_id = auth.uid() AND f.addressee_id = s.user_id)
            OR (f.addressee_id = auth.uid() AND f.requester_id = s.user_id)
          )
      )
    )
  GROUP BY s.id, s.workout_id, s.user_id, u.display_name, s.caption,
           wl.session_type, wl.total_duration_s, wl.total_distance_km, s.created_at
  ORDER BY s.created_at DESC
  LIMIT p_limit;
$$;

GRANT EXECUTE ON FUNCTION get_activity_feed TO authenticated;

-- ── 8. log_hydration — re-declare defensively (see hydration.ts / 018) ──────

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
