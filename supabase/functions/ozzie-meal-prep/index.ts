// Ozzie Meal Prep — a day of meals matched to the athlete's real macro
// target, that day's training session, and their grocery budget.
//
// Reads the same nutrition_targets row ozzie-nutrition-coach maintains
// (so the meal plan and the Log tab always agree on the numbers), plus
// today's planned session (training vs rest shifts carb allocation) and
// the budget prefs on user_preferences. GPT-4o-mini returns structured
// meals + a consolidated grocery list with estimated costs; both are
// persisted (meal_plan_days, grocery_items) so repeat opens are free.
//
// Grocery upsert deliberately does NOT touch `checked` on existing rows —
// regenerating a plan mid-week must not wipe the user's in-store progress.

import { createClient } from 'jsr:@supabase/supabase-js@2';

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY') ?? '';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const SYSTEM_PROMPT = `You are Ozzie, the AI coach inside the OSPREY fitness app — warm, enthusiastic, Kronk-spirited, and secretly an excellent meal-prep cook. The user is a hybrid athlete: food is fuel for performance. Protein at every meal is non-negotiable; carbs cluster around training.

Your job: plan ONE day of eating (3-5 meals including snacks) that hits the macro targets provided, using simple, realistic, batch-preppable food a busy athlete will actually cook. Ordinary grocery-store ingredients only.

Budget rules:
- You are given budgetPerDay in USD (or null if the user set no budget). If set, the estimated total ingredient cost for the day MUST come in at or under it. Favor cheap protein (eggs, chicken thighs, canned tuna, greek yogurt, beans, ground turkey), bulk carbs (rice, oats, potatoes, pasta), frozen vegetables.
- Estimate costs realistically for a mid-priced US grocery store. Costs are per-day share of the ingredient actually consumed (e.g. if a meal uses half a $4 bag of rice, that's $2... no wait, cost the amount consumed that day: ~$0.40 of rice).
- If the budget is very tight, say so honestly in ozzieNote and prioritize protein first, calories second.

Macro rules:
- The day's meals must sum to within ±5% of target calories and within ±10g of target protein. Carbs/fat within ±15%.
- If sessionType is a training day (run/lift/swim/bike/cross/race), put the biggest carb meals before and after the session slot. On rest days, spread carbs evenly and lean slightly higher fat/protein.
- Respect dietaryNotes strictly (allergies, dislikes, vegetarian, etc.).

Respond ONLY with valid JSON:
{
  "meals": [
    {
      "name": string,            // e.g. "Overnight oats + whey"
      "slot": string,            // "breakfast" | "lunch" | "dinner" | "snack" | "pre-workout" | "post-workout"
      "description": string,     // 1-2 sentences: what it is and the quick how-to
      "calories": number,
      "proteinG": number,
      "carbsG": number,
      "fatG": number,
      "estCost": number          // USD, ingredients consumed in this meal
    }
  ],
  "groceries": [
    {
      "name": string,            // e.g. "Chicken thighs"
      "quantity": string,        // e.g. "2 lbs"
      "category": string,        // "protein" | "produce" | "grains" | "dairy" | "pantry" | "frozen" | "other"
      "estCost": number          // USD for the quantity listed
    }
  ],
  "estTotalCost": number,        // sum of meal estCosts (the day's consumed cost)
  "ozzieNote": string            // 1-2 sentences in Ozzie's voice about today's plan
}`;

interface MealPlanResponse {
  meals: Array<{
    name: string;
    slot: string;
    description: string;
    calories: number;
    proteinG: number;
    carbsG: number;
    fatG: number;
    estCost: number;
  }>;
  groceries: Array<{
    name: string;
    quantity: string;
    category: string;
    estCost: number;
  }>;
  estTotalCost: number;
  ozzieNote: string;
}

function validatePlan(parsed: unknown): MealPlanResponse {
  const p = parsed as Partial<MealPlanResponse>;
  if (!Array.isArray(p.meals) || p.meals.length === 0) {
    throw new Error('Model returned no meals');
  }
  if (!Array.isArray(p.groceries)) {
    throw new Error('Model returned no grocery list');
  }
  const num = (v: unknown) => (typeof v === 'number' && isFinite(v) ? v : 0);
  const str = (v: unknown, fallback: string) => (typeof v === 'string' && v.trim() ? v : fallback);

  return {
    meals: p.meals.map((m) => ({
      name: str(m?.name, 'Meal'),
      slot: str(m?.slot, 'snack'),
      description: str(m?.description, ''),
      calories: Math.round(num(m?.calories)),
      proteinG: Math.round(num(m?.proteinG)),
      carbsG: Math.round(num(m?.carbsG)),
      fatG: Math.round(num(m?.fatG)),
      estCost: Math.round(num(m?.estCost) * 100) / 100,
    })),
    groceries: p.groceries.map((g) => ({
      name: str(g?.name, 'Item'),
      quantity: str(g?.quantity, ''),
      category: str(g?.category, 'other'),
      estCost: Math.round(num(g?.estCost) * 100) / 100,
    })),
    estTotalCost: Math.round(num(p.estTotalCost) * 100) / 100,
    ozzieNote: str(p.ozzieNote, "Fuel's ready — go earn it."),
  };
}

/** Monday (local-to-server; dates here are plain DATE keys) of the week containing dateStr. */
function weekOf(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  const day = date.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setUTCDate(date.getUTCDate() + diff);
  return date.toISOString().slice(0, 10);
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

  try {
    const body = await req.json().catch(() => ({}));
    // The client sends its LOCAL date so "today's plan" matches the user's
    // day, not the server's UTC day. Falls back to server date if absent.
    const planDate: string =
      typeof body?.planDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.planDate)
        ? body.planDate
        : new Date().toISOString().slice(0, 10);
    const force: boolean = body?.force === true;

    // Cached plan for this date?
    if (!force) {
      const { data: existing } = await supabase
        .from('meal_plan_days')
        .select('meals, target_calories, target_protein_g, target_carbs_g, target_fat_g, est_total_cost, budget_per_day, session_type, ozzie_note')
        .eq('user_id', userId)
        .eq('plan_date', planDate)
        .maybeSingle();

      if (existing) {
        return new Response(
          JSON.stringify({
            planDate,
            meals: existing.meals,
            target: {
              calories: existing.target_calories,
              proteinG: existing.target_protein_g,
              carbsG: existing.target_carbs_g,
              fatG: existing.target_fat_g,
            },
            estTotalCost: existing.est_total_cost,
            budgetPerDay: existing.budget_per_day,
            sessionType: existing.session_type,
            ozzieNote: existing.ozzie_note,
            cached: true,
          }),
          { headers: { 'Content-Type': 'application/json' } },
        );
      }
    }

    // Gather: real macro target, today's session, budget + dietary prefs.
    const [targetRes, sessionRes, prefsRes] = await Promise.all([
      supabase
        .from('nutrition_targets')
        .select('calories, protein_g, carbs_g, fat_g')
        .eq('user_id', userId)
        .maybeSingle(),
      supabase
        .from('training_sessions')
        .select('session_type, planned_minutes')
        .eq('user_id', userId)
        .eq('session_date', planDate)
        .maybeSingle(),
      supabase
        .from('user_preferences')
        .select('grocery_budget_amount, grocery_budget_period, dietary_notes')
        .eq('user_id', userId)
        .maybeSingle(),
    ]);

    // Sensible hybrid-athlete fallback if the nutrition coach hasn't run yet.
    const target = targetRes.data
      ? {
          calories: targetRes.data.calories,
          proteinG: targetRes.data.protein_g,
          carbsG: targetRes.data.carbs_g,
          fatG: targetRes.data.fat_g,
        }
      : { calories: 2600, proteinG: 200, carbsG: 280, fatG: 75 };

    const sessionType = sessionRes.data?.session_type ?? 'rest';

    const prefs = prefsRes.data ?? {
      grocery_budget_amount: null,
      grocery_budget_period: null,
      dietary_notes: null,
    };
    let budgetPerDay: number | null = null;
    if (prefs.grocery_budget_amount != null && prefs.grocery_budget_period) {
      const amount = Number(prefs.grocery_budget_amount);
      budgetPerDay =
        prefs.grocery_budget_period === 'weekly'
          ? Math.round((amount / 7) * 100) / 100
          : Math.round((amount / 30) * 100) / 100;
    }

    const userMessage = JSON.stringify(
      {
        planDate,
        target,
        sessionType,
        plannedMinutes: sessionRes.data?.planned_minutes ?? null,
        budgetPerDay,
        dietaryNotes: prefs.dietary_notes ?? null,
      },
      null,
      2,
    );

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: `Plan today's meals:\n${userMessage}` },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.7,
        max_tokens: 1800,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('OpenAI error:', response.status, errText);
      throw new Error('Meal generation failed — please try again.');
    }

    const json = await response.json();
    const content = json.choices?.[0]?.message?.content;
    if (!content) throw new Error('Meal generation returned nothing — please try again.');
    const plan = validatePlan(JSON.parse(content));

    // Persist the day plan (regenerate = overwrite).
    await supabase.from('meal_plan_days').upsert(
      {
        user_id: userId,
        plan_date: planDate,
        meals: plan.meals,
        target_calories: target.calories,
        target_protein_g: target.proteinG,
        target_carbs_g: target.carbsG,
        target_fat_g: target.fatG,
        est_total_cost: plan.estTotalCost,
        budget_per_day: budgetPerDay,
        session_type: sessionType,
        ozzie_note: plan.ozzieNote,
      },
      { onConflict: 'user_id,plan_date' },
    );

    // Merge groceries into the week's list WITHOUT clobbering `checked` on
    // items the user already has: skip names already on the list, insert only
    // the genuinely new ones unchecked. Existing rows are left untouched so an
    // in-store check survives a mid-week regenerate.
    const week = weekOf(planDate);
    const { data: existingItems } = await supabase
      .from('grocery_items')
      .select('name')
      .eq('user_id', userId)
      .eq('week_of', week);
    const seenNames = new Set((existingItems ?? []).map((r) => String(r.name).toLowerCase()));

    // Dedupe within this response too: the UNIQUE(user_id, week_of, name)
    // constraint means two groceries with the same name in one batch would
    // otherwise fail the whole insert and silently drop every new item.
    const toInsert: Array<Record<string, unknown>> = [];
    for (const g of plan.groceries) {
      const key = g.name.toLowerCase();
      if (seenNames.has(key)) continue;
      seenNames.add(key);
      toInsert.push({
        user_id: userId,
        week_of: week,
        name: g.name,
        quantity: g.quantity,
        category: g.category,
        est_cost: g.estCost,
      });
    }
    if (toInsert.length > 0) {
      const { error: groceryInsertError } = await supabase.from('grocery_items').insert(toInsert);
      if (groceryInsertError) {
        // Non-fatal — the meal plan itself is already saved and returned; the
        // grocery list just won't have this run's items. Log for visibility.
        console.error('grocery insert error:', groceryInsertError);
      }
    }

    return new Response(
      JSON.stringify({
        planDate,
        meals: plan.meals,
        target,
        estTotalCost: plan.estTotalCost,
        budgetPerDay,
        sessionType,
        ozzieNote: plan.ozzieNote,
        cached: false,
      }),
      { headers: { 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    console.error('ozzie-meal-prep error:', err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Unknown error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }
});
