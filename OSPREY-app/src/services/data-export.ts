import { supabase } from '@/services/supabase';

/** Triggers the server-side export job; returns the address it was sent to. */
export async function requestDataExport(): Promise<{ email: string }> {
  const { data, error } = await supabase.functions.invoke<{ sent: boolean; email: string }>(
    'ozzie-data-export',
    { method: 'POST' },
  );

  if (error || !data?.sent) {
    throw error ?? new Error('Failed to send data export');
  }

  return { email: data.email };
}
