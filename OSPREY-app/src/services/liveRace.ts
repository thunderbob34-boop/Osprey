import { format } from 'date-fns';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '@/services/supabase';

/**
 * Live squad race tracking — positions travel over a Supabase Realtime
 * broadcast channel scoped to the race id. Nothing is persisted: the
 * channel is ephemeral by design (race-morning data, gone after).
 *
 * Broadcaster: the racer's run screen, when they toggle "Live for my crew"
 * on race day. Watchers: partners' race screens subscribed to the same
 * channel. Both sides authenticate with their normal Supabase session.
 */

export interface LivePositionPayload {
  userId: string;
  displayName: string;
  distanceMiles: number;
  elapsedS: number;
  paceLabel: string; // preformatted "8:45/mi" — avoids recomputing on every watcher
  lat: number | null;
  lon: number | null;
  sentAt: string; // ISO timestamp, lets watchers grey out stale racers
}

function channelName(raceId: string): string {
  return `live-race:${raceId}`;
}

/** The caller's own race happening today, if any — gates the live toggle. */
export async function fetchTodaysRace(
  userId: string,
): Promise<{ raceId: string; raceName: string } | null> {
  const today = format(new Date(), 'yyyy-MM-dd');
  const { data, error } = await supabase
    .from('race_events')
    .select('id, name')
    .eq('user_id', userId)
    .eq('event_date', today)
    .is('deleted_at', null)
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;
  return { raceId: data.id, raceName: data.name };
}

// ── Broadcasting (the racer) ──────────────────────────────────────────────────

let broadcastChannel: RealtimeChannel | null = null;
let lastSentMs = 0;
const MIN_SEND_INTERVAL_MS = 10_000; // ~6 updates/min is plenty for spectators

export async function startLiveBroadcast(raceId: string): Promise<void> {
  if (broadcastChannel) return;
  const channel = supabase.channel(channelName(raceId), {
    config: { broadcast: { self: false } },
  });
  try {
    await new Promise<void>((resolve, reject) => {
      channel.subscribe((status) => {
        if (status === 'SUBSCRIBED') resolve();
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          reject(new Error('Could not go live — check your connection.'));
        }
      });
    });
    // Only mark it active once the subscribe actually succeeded — otherwise a
    // failed attempt would leave a wedged non-null channel that the guard above
    // treats as "already live", so retrying does nothing while the UI says LIVE.
    broadcastChannel = channel;
  } catch (err) {
    await supabase.removeChannel(channel).catch(() => undefined);
    throw err;
  }
}

/** Throttled — safe to call from every GPS tick. */
export function publishLivePosition(payload: LivePositionPayload): void {
  if (!broadcastChannel) return;
  const now = Date.now();
  if (now - lastSentMs < MIN_SEND_INTERVAL_MS) return;
  lastSentMs = now;
  broadcastChannel
    .send({ type: 'broadcast', event: 'position', payload })
    .catch(() => undefined); // a dropped live frame is not worth surfacing mid-race
}

export async function stopLiveBroadcast(): Promise<void> {
  if (!broadcastChannel) return;
  const channel = broadcastChannel;
  broadcastChannel = null;
  lastSentMs = 0;
  await supabase.removeChannel(channel).catch(() => undefined);
}

// ── Watching (the crew) ───────────────────────────────────────────────────────

/**
 * Watch the whole crew at an event. Because each partner broadcasts on their
 * OWN race-id channel (rows are per-user), the watcher resolves its partners'
 * race ids via get_crew_race_ids and subscribes to every one of them plus its
 * own — otherwise a watcher keyed on its own race id would never receive a
 * partner's broadcasts. Returns a Promise of an unsubscribe fn that tears down
 * every channel it opened.
 */
export async function watchCrew(
  ownRaceId: string,
  onPosition: (payload: LivePositionPayload) => void,
): Promise<() => void> {
  const raceIds = new Set<string>([ownRaceId]);
  try {
    const { data } = await supabase.rpc('get_crew_race_ids', { p_race_id: ownRaceId });
    for (const row of (data ?? []) as { partner_race_id: string }[]) {
      if (row.partner_race_id) raceIds.add(row.partner_race_id);
    }
  } catch {
    // Fall back to own channel only — better a partial view than none.
  }

  const channels = [...raceIds].map((raceId) => {
    const channel = supabase.channel(channelName(raceId), {
      config: { broadcast: { self: false } },
    });
    channel.on('broadcast', { event: 'position' }, ({ payload }) => {
      if (payload && typeof payload.userId === 'string') {
        onPosition(payload as LivePositionPayload);
      }
    });
    channel.subscribe();
    return channel;
  });

  return () => {
    for (const channel of channels) {
      supabase.removeChannel(channel).catch(() => undefined);
    }
  };
}

// ── Partner results (post-race, for the shared retro) ────────────────────────

export interface PartnerRaceResult {
  partnerUserId: string;
  partnerDisplayName: string;
  resultTimeS: number | null;
  goalTimeS: number | null;
}

export async function fetchPartnerRaceResults(raceId: string): Promise<PartnerRaceResult[]> {
  const { data, error } = await supabase.rpc('get_partner_race_results', { p_race_id: raceId });
  if (error) throw error;
  return (data ?? []).map((row: {
    partner_user_id: string;
    partner_display_name: string;
    result_time_s: number | null;
    goal_time_s: number | null;
  }) => ({
    partnerUserId: row.partner_user_id,
    partnerDisplayName: row.partner_display_name,
    resultTimeS: row.result_time_s,
    goalTimeS: row.goal_time_s,
  }));
}
