import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { supabase } from '../../lib/supabase';
import { ExerciseSchema, ExerciseSetSchema, TrainingSessionSchema, WorkoutLogSchema, type WorkoutLog } from '../../lib/schemas';
import { toDateInputValue } from '../../lib/day';

export function useCreateWorkout(userId: string) {
  return useMutation({
    mutationFn: async (input: { startedAt: string; sessionId: string | null }): Promise<WorkoutLog> => {
      // Was 'completed' at creation — the calendar, history, and stats all
      // counted the launch itself as a finished workout, before a single set
      // existed. Starts 'planned'; useCommitSet flips it to 'completed' the
      // moment a set is actually logged.
      const { data, error } = await supabase.from('workout_logs')
        .insert({ user_id: userId, session_type: 'lift', status: 'planned', started_at: input.startedAt, session_id: input.sessionId })
        .select().single();
      if (error) throw error;
      return WorkoutLogSchema.parse(data);
    },
  });
}

export function useWorkout(workoutId: string) {
  return useQuery({
    queryKey: ['workout', workoutId],
    queryFn: async (): Promise<WorkoutLog> => {
      const { data, error } = await supabase.from('workout_logs').select('*').eq('id', workoutId).is('deleted_at', null).single();
      if (error) throw error;
      return WorkoutLogSchema.parse(data);
    },
  });
}

const SetWithExercise = ExerciseSetSchema.extend({ exercises: z.object({ name: z.string() }).nullable() });
export type SetWithExercise = z.infer<typeof SetWithExercise>;

export function useSets(workoutId: string) {
  return useQuery({
    queryKey: ['sets', workoutId],
    queryFn: async () => {
      const { data, error } = await supabase.from('exercise_sets')
        .select('*, exercises(name)').eq('workout_id', workoutId).order('created_at', { ascending: true });
      if (error) throw error;
      return z.array(SetWithExercise).parse(data);
    },
  });
}

export function useCommitSet(workoutId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { dbId: string | null; exerciseId: string; setNumber: number; reps: number | null; weightKg: number | null; rpe: number | null }): Promise<{ dbId: string }> => {
      if (input.dbId) {
        const { error } = await supabase.from('exercise_sets')
          .update({ exercise_id: input.exerciseId, set_number: input.setNumber, reps: input.reps, weight_kg: input.weightKg, rpe: input.rpe })
          .eq('id', input.dbId);
        if (error) throw error;
        return { dbId: input.dbId };
      }
      const { data, error } = await supabase.from('exercise_sets')
        .insert({ workout_id: workoutId, exercise_id: input.exerciseId, set_number: input.setNumber, reps: input.reps, weight_kg: input.weightKg, rpe: input.rpe })
        .select('id').single();
      if (error) throw error;
      // First real set logged — the workout was created 'planned' (see
      // useCreateWorkout); this is the moment it actually becomes completed.
      // Safe to call on every new set: matches only the 'planned' row, so
      // it's a no-op once the workout is already completed.
      await supabase.from('workout_logs').update({ status: 'completed' })
        .eq('id', workoutId).eq('status', 'planned');
      return { dbId: (data as { id: string }).id };
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: ['sets', workoutId] });
      void qc.invalidateQueries({ queryKey: ['workout', workoutId] });
    },
  });
}

export function useDeleteSet(workoutId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (dbId: string) => {
      const { error } = await supabase.from('exercise_sets').delete().eq('id', dbId);
      if (error) throw error;
    },
    onSettled: () => void qc.invalidateQueries({ queryKey: ['sets', workoutId] }),
  });
}

export function useUpdateWorkout(workoutId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (patch: { perceived_effort?: number | null; notes?: string | null; total_duration_s?: number | null }) => {
      const { error } = await supabase.from('workout_logs').update(patch).eq('id', workoutId);
      if (error) throw error;
    },
    onSettled: () => void qc.invalidateQueries({ queryKey: ['workout', workoutId] }),
  });
}

export function useExerciseSearch(term: string) {
  return useQuery({
    queryKey: ['exercises', term],
    enabled: term.trim().length >= 2,
    queryFn: async () => {
      const { data, error } = await supabase.from('exercises').select('*').ilike('name', `%${term.trim()}%`).order('name').limit(10);
      if (error) throw error;
      return z.array(ExerciseSchema).parse(data);
    },
  });
}

export function useWeekSessions(userId: string) {
  const now = new Date();
  const day = (now.getDay() + 6) % 7; // Monday=0
  const monday = new Date(now); monday.setDate(now.getDate() - day);
  const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6);
  const iso = toDateInputValue;
  return useQuery({
    queryKey: ['weekSessions', userId, iso(monday)],
    queryFn: async () => {
      const { data, error } = await supabase.from('training_sessions').select('*')
        .eq('user_id', userId).gte('session_date', iso(monday)).lte('session_date', iso(sunday)).order('session_date');
      if (error) throw error;
      return z.array(TrainingSessionSchema).parse(data);
    },
  });
}
