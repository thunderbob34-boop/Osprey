-- Enforce the product invariant: at most one ACTIVE, non-deleted training plan
-- per user. This closes the ozzie-generate-plan idempotency race, where two
-- concurrent generations could each pass the "no active week for this Monday"
-- check and then each insert a fresh active plan. The edge function catches the
-- resulting unique_violation (23505) and reuses the existing plan instead.
--
-- Resolve any pre-existing duplicates FIRST so the index can be created on live
-- data: keep the most recently created active plan per user, archive the rest.
WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY user_id
      ORDER BY created_at DESC, id DESC
    ) AS rn
  FROM training_plans
  WHERE status = 'active' AND deleted_at IS NULL
)
UPDATE training_plans p
SET status = 'archived'
FROM ranked r
WHERE p.id = r.id AND r.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_one_active_plan_per_user
  ON training_plans (user_id)
  WHERE status = 'active' AND deleted_at IS NULL;
