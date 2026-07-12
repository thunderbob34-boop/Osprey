import { describe, it, expect } from 'vitest';
import { WorkoutLogSchema, ExerciseSetSchema, TrainingSessionSchema, SessionTypeEnum } from '../src/lib/schemas';

describe('schemas', () => {
  it('session type enum matches DB exactly', () => {
    expect(SessionTypeEnum.options).toEqual(['run', 'lift', 'cross', 'rest', 'race', 'swim', 'bike', 'rowing', 'hyrox']);
  });
  it('parses a representative workout_logs row', () => {
    const row = {
      id: '4d2f7a44-0000-4000-8000-000000000001', user_id: '4d2f7a44-0000-4000-8000-000000000002',
      session_id: null, started_at: '2026-07-12T14:00:00+00:00', ended_at: null,
      session_type: 'lift', status: 'completed', perceived_effort: 7,
      total_distance_km: null, total_duration_s: 3600, avg_heart_rate: null, max_heart_rate: null,
      calories_burned: null, tss: null, notes: 'upper', created_at: '2026-07-12T14:00:00+00:00',
      updated_at: '2026-07-12T14:00:00+00:00', deleted_at: null,
    };
    expect(WorkoutLogSchema.parse(row).session_type).toBe('lift');
  });
  it('parses an exercise_sets row and rejects bad rpe', () => {
    const base = { id: '4d2f7a44-0000-4000-8000-000000000003', workout_id: '4d2f7a44-0000-4000-8000-000000000001',
      exercise_id: '4d2f7a44-0000-4000-8000-000000000004', set_number: 1, reps: 8, weight_kg: 83.91,
      duration_s: null, rpe: 8, created_at: '2026-07-12T14:00:00+00:00' };
    expect(ExerciseSetSchema.parse(base).weight_kg).toBe(83.91);
    expect(() => ExerciseSetSchema.parse({ ...base, rpe: 11 })).toThrow();
  });
  it('parses a training_sessions row', () => {
    const row = { id: '4d2f7a44-0000-4000-8000-000000000005', week_id: '4d2f7a44-0000-4000-8000-000000000006',
      user_id: '4d2f7a44-0000-4000-8000-000000000002', session_date: '2026-07-14', session_type: 'run',
      intensity: 'threshold', planned_minutes: 50, planned_distance_km: 10, description: 'Tempo',
      ozzie_notes: null, created_at: '2026-07-12T14:00:00+00:00', updated_at: '2026-07-12T14:00:00+00:00' };
    expect(TrainingSessionSchema.parse(row).intensity).toBe('threshold');
  });
});
