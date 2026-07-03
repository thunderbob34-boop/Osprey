-- ============================================================
-- OSPREY 019 — Live squad race tracking support
-- Live positions travel over Supabase Realtime broadcast channels
-- (ephemeral, no table). This migration adds the one DB piece the
-- feature needs: a partner-results lookup so the post-race retro can
-- include how the athlete's training partners finished the same event.
-- ============================================================

-- ── RPC: get_partner_race_results ─────────────────────────────────────────────
-- For a race the caller OWNS, returns each linked partner's finish time for
-- their own race_events row on the same event date (matched by date since
-- each athlete tracks the race as their own row). SECURITY DEFINER because
-- race_events and users are self-only under RLS; the owner gate mirrors
-- get_race_partners (013).

CREATE OR REPLACE FUNCTION get_partner_race_results(p_race_id UUID)
RETURNS TABLE(
  partner_user_id       UUID,
  partner_display_name  TEXT,
  result_time_s         INT,
  goal_time_s           INT
)
SECURITY DEFINER
SET search_path = public
LANGUAGE sql
STABLE
AS $$
  SELECT
    rp.partner_user_id,
    u.display_name AS partner_display_name,
    pre.result_time_s,
    pre.goal_time_s
  FROM race_partners rp
  JOIN race_events mine
    ON  mine.id = rp.race_id
    AND mine.user_id = auth.uid()
    AND mine.deleted_at IS NULL
  JOIN users u ON u.id = rp.partner_user_id AND u.deleted_at IS NULL
  LEFT JOIN race_events pre
    ON  pre.user_id = rp.partner_user_id
    AND pre.event_date = mine.event_date
    AND pre.deleted_at IS NULL
  WHERE rp.race_id = p_race_id
  ORDER BY u.display_name;
$$;

GRANT EXECUTE ON FUNCTION get_partner_race_results TO authenticated;
