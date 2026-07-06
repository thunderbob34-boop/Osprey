-- 024_challenge_types.sql
-- Adds 'lift_volume' and 'streak' challenge types so competitions aren't
-- limited to mileage/workout-count/duration — hybrid athletes who lift more
-- than they run get a fair competition too.
-- ALTER TYPE ... ADD VALUE cannot run in the same transaction as a statement
-- that USES the new value (see 021_triathlon_goal.sql), so the leaderboard
-- function update that references these values lives in a separate migration.

ALTER TYPE challenge_type_enum ADD VALUE IF NOT EXISTS 'lift_volume';
ALTER TYPE challenge_type_enum ADD VALUE IF NOT EXISTS 'streak';
