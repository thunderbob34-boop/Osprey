-- 037_training_weeks_volume_multiplier.sql
-- ozzie-generate-plan v2 needs to persist each week's phase-derived volume
-- multiplier (relative to a full-volume week) so a week regenerated later
-- (e.g. after a missed-session reschedule, or an explicit rebuild) keeps its
-- originally-decided Base/Build/Peak/Taper volume instead of recomputing it
-- from scratch. tss_target already exists but means something different (a
-- literal weekly TSS target, currently unused by any writer) — add a
-- properly-named column instead of overloading it.

ALTER TABLE training_weeks
  ADD COLUMN IF NOT EXISTS volume_multiplier NUMERIC(4,2);
