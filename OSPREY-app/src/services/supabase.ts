import { createClient } from '@supabase/supabase-js';
import 'react-native-url-polyfill/auto';
import { secureSessionStorage } from './secure-session-storage';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: secureSessionStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

/**
 * supabase.functions.invoke() collapses any non-2xx response into a generic
 * "Edge Function returned a non-2xx status code" error and buries the actual
 * { error: "..." } JSON body the function returned inside error.context (a
 * Response object). This pulls the real message back out for display, trying
 * several extraction strategies since the exact shape varies by error type
 * and never falling back to a bare String(object) (which silently renders
 * "[object Object]" for any non-primitive).
 */
export async function extractFunctionErrorMessage(error: unknown): Promise<string> {
  const context = error && typeof error === 'object' && 'context' in error
    ? (error as { context?: unknown }).context
    : undefined;

  if (context instanceof Response) {
    try {
      const cloned = context.clone();
      const text = await cloned.text();
      try {
        const body = JSON.parse(text);
        if (typeof body?.error === 'string') return body.error;
        if (typeof body?.message === 'string') return body.message;
        if (body?.error) return JSON.stringify(body.error);
      } catch {
        if (text) return text;
      }
    } catch {
      // Response body already consumed or unreadable — fall through.
    }
  }

  if (error instanceof Error && error.message) return error.message;

  if (error && typeof error === 'object') {
    try {
      return JSON.stringify(error);
    } catch {
      // circular or unserializable — fall through to generic message
    }
  }

  return 'Something went wrong. Try again.';
}
