-- Phase 1 coaching-engine fidelity: store the athlete's derived/entered threshold
-- anchor, and per-session fuel targets emitted by the envelope.
ALTER TABLE user_goals        ADD COLUMN IF NOT EXISTS threshold_anchor JSONB;
ALTER TABLE training_sessions ADD COLUMN IF NOT EXISTS fuel JSONB;
