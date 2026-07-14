// Ozzie Meal Photo — estimates a food log entry from a photo
//
// Takes a base64-encoded meal photo and asks GPT-4o-mini (vision) to
// identify the food and estimate calories/macros for a single typical
// serving. This is a best-effort estimate, not a precise nutrition source —
// the client lets the user edit before saving.

import { createClient } from 'jsr:@supabase/supabase-js@2';

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY') ?? '';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const VISION_SYSTEM_PROMPT = `You are Ozzie, the AI coach inside the OSPREY fitness app, helping estimate nutrition info from a meal photo.

Rules:
- Identify the food(s) in the photo and give a short, natural name (e.g. "Grilled chicken bowl with rice").
- Estimate calories and macros for the single serving shown, using your best visual judgement of portion size. These are estimates, not lab measurements — give your best single number, not a range.
- If the photo doesn't clearly show food, set "isFood" to false and leave other fields at 0/null.
- Respond ONLY with valid JSON matching this shape: {"isFood": boolean, "name": string, "calories": number, "proteinG": number, "carbsG": number, "fatG": number, "confidenceNote": string}
- "confidenceNote" is one short sentence acknowledging this is an estimate, in Ozzie's warm/goofy-but-genuine voice (e.g. "Eyeballing it here, but that looks like a solid plate!").`;

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

  try {
    const { imageBase64 } = await req.json();
    if (!imageBase64 || typeof imageBase64 !== 'string') {
      return new Response(JSON.stringify({ error: 'Missing imageBase64' }), { status: 400 });
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: VISION_SYSTEM_PROMPT },
          {
            role: 'user',
            content: [
              { type: 'text', text: 'Estimate the nutrition info for this meal photo.' },
              { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${imageBase64}` } },
            ],
          },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.4,
        max_tokens: 300,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`OpenAI error: ${response.status} ${errText}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error('OpenAI returned no content');

    const parsed = JSON.parse(content);

    return new Response(
      JSON.stringify({
        isFood: parsed.isFood ?? true,
        name: parsed.name ?? 'Meal',
        calories: Math.round(parsed.calories ?? 0),
        proteinG: Math.round((parsed.proteinG ?? 0) * 10) / 10,
        carbsG: Math.round((parsed.carbsG ?? 0) * 10) / 10,
        fatG: Math.round((parsed.fatG ?? 0) * 10) / 10,
        confidenceNote: parsed.confidenceNote ?? "Best guess here — feel free to adjust before saving.",
      }),
      { headers: { 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    console.error('ozzie-meal-photo error', err);
    return new Response(JSON.stringify({ error: 'Something went wrong. Please try again.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
