-- WS1 (Runna gap-close): an append-only ledger of every threshold-anchor
-- derivation, so the fitness curve behind the plan is reconstructable. A JSONB
-- column (user_goals.threshold_anchor) holds only CURRENT state — every
-- re-anchor overwrites it, so history you didn't record here is gone forever.
-- That curve is the point of a re-anchoring coach (WS6), so this table exists
-- independently of whether WS6 has shipped yet.
--
-- Deliberately APPEND-ONLY: no UPDATE or DELETE policy, and no superseded_at
-- column — current value for a key is max(recorded_at). A row that can be
-- updated is a row that can be destroyed, which defeats the point.
--
-- Explicit service_role grant (not relying on 20260628000008's blanket grant):
-- that migration is GRANT ALL ON ALL TABLES IN SCHEMA public, a point-in-time
-- grant that does NOT cover tables created afterward. Omitting the explicit
-- grant here is exactly the class of bug that caused the ozzie-chat launch-day
-- outage (a new table granted to authenticated but not service_role, so every
-- edge-function request 404'd) — see MEMORY.md's osprey-webapp entry.

CREATE TABLE anchor_history (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                 UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  anchor_key              TEXT NOT NULL CHECK (anchor_key IN ('run', 'swim', 'row', 'bike')),
  value_numeric           NUMERIC NOT NULL,      -- sec/mi | sec/100m | sec/500m | watts, by anchor_key
  unit                    TEXT NOT NULL,
  source                  TEXT NOT NULL CHECK (source IN ('self_report', 'derived', 'estimate')),
  confidence              TEXT NOT NULL CHECK (confidence IN ('low', 'moderate', 'high')),
  effort_duration_s       INTEGER,               -- source effort's duration; extrapolation distance from the ~60min threshold construct
  qualifying_effort_count SMALLINT,
  reanchor_trigger        TEXT NOT NULL DEFAULT 'interval' CHECK (reanchor_trigger IN ('interval', 'tuneup_race')),
  reanchor_due_at         TIMESTAMPTZ,
  derived_from            JSONB,                 -- source HealthKit workout: externalId, startedAt, distance, time — null for self-report/estimate
  recorded_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_anchor_history_user_key_time
  ON anchor_history(user_id, anchor_key, recorded_at DESC);

ALTER TABLE anchor_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY anchor_history_select ON anchor_history
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY anchor_history_insert ON anchor_history
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- No UPDATE or DELETE policy for `authenticated` — RLS defaults to deny, so
-- both are rejected outright. This is the append-only guarantee.

GRANT SELECT, INSERT ON anchor_history TO authenticated;
GRANT ALL ON anchor_history TO service_role;
