import { daysUntil } from '../lib/day';
import { formatRaceTimeSec } from '../lib/predictions';
import type { RaceEvent } from '../lib/schemas';

export function RaceCountdown({ race }: { race: Pick<RaceEvent, 'name' | 'event_date' | 'distance_km' | 'goal_time_s'> }) {
  return (
    <div className="race-countdown">
      <div className="days">T–{Math.max(0, daysUntil(race.event_date))}</div>
      <div className="lab">Days to race</div>
      <div className="name">{race.name}</div>
      <div className="meta">
        {new Date(`${race.event_date}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
        {race.distance_km ? ` · ${race.distance_km}km` : ''}
        {race.goal_time_s ? ` · Goal ${formatRaceTimeSec(race.goal_time_s)}` : ''}
      </div>
    </div>
  );
}
