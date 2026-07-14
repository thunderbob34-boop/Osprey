// Data export — emails the caller a CSV copy of their own OSPREY data.
// Pairs with account deletion for trust: a user shouldn't have to ask
// support for a copy of what they logged before they can decide to leave.

import { createClient } from 'jsr:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? '';
const EXPORT_FROM_EMAIL = Deno.env.get('EXPORT_FROM_EMAIL') ?? 'OSPREY <exports@osprey.app>';

// ── CSV helpers ───────────────────────────────────────────────────────────────

function csvCell(value: unknown): string {
  if (value == null) return '';
  const str = String(value);
  return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

function toCsv(rows: Array<Record<string, unknown>>, columns: string[]): string {
  const header = columns.join(',');
  const body = rows.map((row) => columns.map((c) => csvCell(row[c])).join(','));
  return [header, ...body].join('\n');
}

/** UTF-8-safe base64 encode without pulling in an extra Deno std import. */
function toBase64(str: string): string {
  return btoa(unescape(encodeURIComponent(str)));
}

// ── Data gathering ────────────────────────────────────────────────────────────

async function gatherCsvAttachments(
  supabase: ReturnType<typeof createClient>,
  userId: string,
): Promise<Array<{ filename: string; content: string }>> {
  const [workoutsRes, setsRes, foodRes, weightRes, racesRes] = await Promise.all([
    supabase
      .from('workout_logs')
      .select('id, session_type, started_at, ended_at, total_duration_s, total_distance_km, avg_heart_rate, max_heart_rate, notes')
      .eq('user_id', userId)
      .is('deleted_at', null)
      .order('started_at', { ascending: true }),
    supabase
      .from('exercise_sets')
      .select('workout_id, set_number, reps, weight_kg, duration_s, rpe, exercises(name), workout_logs!inner(user_id, started_at, deleted_at)')
      .eq('workout_logs.user_id', userId)
      .is('workout_logs.deleted_at', null)
      .order('workout_id', { ascending: true })
      .order('set_number', { ascending: true }),
    supabase
      .from('food_log_entries')
      .select('logged_at, meal_type, quantity_g, calories, protein_g, carbs_g, fat_g, food_items(name)')
      .eq('user_id', userId)
      .order('logged_at', { ascending: true }),
    supabase
      .from('body_metrics')
      .select('recorded_on, weight_kg, body_fat_pct, notes')
      .eq('user_id', userId)
      .order('recorded_on', { ascending: true }),
    supabase
      .from('race_events')
      .select('name, distance_km, event_date, location, goal_time_s, result_time_s, notes')
      .eq('user_id', userId)
      .is('deleted_at', null)
      .order('event_date', { ascending: true }),
  ]);

  const workoutsCsv = toCsv(
    (workoutsRes.data ?? []) as Array<Record<string, unknown>>,
    ['id', 'session_type', 'started_at', 'ended_at', 'total_duration_s', 'total_distance_km', 'avg_heart_rate', 'max_heart_rate', 'notes'],
  );

  const setsRows = (setsRes.data ?? []).map((row: Record<string, unknown>) => ({
    workout_id: row.workout_id,
    workout_date: (row.workout_logs as { started_at?: string } | null)?.started_at ?? '',
    exercise_name: (row.exercises as { name?: string } | null)?.name ?? '',
    set_number: row.set_number,
    reps: row.reps,
    weight_kg: row.weight_kg,
    duration_s: row.duration_s,
    rpe: row.rpe,
  }));
  const liftSetsCsv = toCsv(setsRows, ['workout_id', 'workout_date', 'exercise_name', 'set_number', 'reps', 'weight_kg', 'duration_s', 'rpe']);

  const foodRows = (foodRes.data ?? []).map((row: Record<string, unknown>) => ({
    logged_at: row.logged_at,
    food_name: (row.food_items as { name?: string } | null)?.name ?? '',
    meal_type: row.meal_type,
    quantity_g: row.quantity_g,
    calories: row.calories,
    protein_g: row.protein_g,
    carbs_g: row.carbs_g,
    fat_g: row.fat_g,
  }));
  const nutritionCsv = toCsv(foodRows, ['logged_at', 'food_name', 'meal_type', 'quantity_g', 'calories', 'protein_g', 'carbs_g', 'fat_g']);

  const bodyweightCsv = toCsv(
    (weightRes.data ?? []) as Array<Record<string, unknown>>,
    ['recorded_on', 'weight_kg', 'body_fat_pct', 'notes'],
  );

  const racesCsv = toCsv(
    (racesRes.data ?? []) as Array<Record<string, unknown>>,
    ['name', 'distance_km', 'event_date', 'location', 'goal_time_s', 'result_time_s', 'notes'],
  );

  return [
    { filename: 'osprey_workouts.csv', content: toBase64(workoutsCsv) },
    { filename: 'osprey_lift_sets.csv', content: toBase64(liftSetsCsv) },
    { filename: 'osprey_nutrition.csv', content: toBase64(nutritionCsv) },
    { filename: 'osprey_bodyweight.csv', content: toBase64(bodyweightCsv) },
    { filename: 'osprey_races.csv', content: toBase64(racesCsv) },
  ];
}

async function sendExportEmail(toEmail: string, attachments: Array<{ filename: string; content: string }>): Promise<void> {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: EXPORT_FROM_EMAIL,
      to: [toEmail],
      subject: 'Your OSPREY data export',
      html: `<p>Here's a full copy of your OSPREY data — workouts, lift sets, nutrition, bodyweight, and races — each as its own CSV attachment.</p><p>If you didn't request this, you can ignore this email.</p>`,
      attachments,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Resend error: ${response.status} ${errText}`);
  }
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Missing Authorization header' }), { status: 401 });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const token = authHeader.replace('Bearer ', '');
  const { data: authData, error: authError } = await supabase.auth.getUser(token);

  if (authError || !authData?.user) {
    return new Response(JSON.stringify({ error: 'Invalid session' }), { status: 401 });
  }

  const userId = authData.user.id;
  const email = authData.user.email;
  if (!email) {
    return new Response(JSON.stringify({ error: 'No email on file for this account' }), { status: 400 });
  }

  try {
    const attachments = await gatherCsvAttachments(supabase, userId);
    await sendExportEmail(email, attachments);
    return new Response(JSON.stringify({ sent: true, email }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('ozzie-data-export error:', err);
    return new Response(JSON.stringify({ error: 'Failed to export data. Please try again.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
