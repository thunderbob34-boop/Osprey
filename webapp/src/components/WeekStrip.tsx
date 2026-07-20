import type { WeekDay } from '../features/home/model';
import { Badge } from './Badge';
import { SESSION_TYPE_LABEL } from '../lib/format';

export function WeekStrip({ days }: { days: WeekDay[] }) {
  return (
    <div className="week-grid">
      {days.map((day) => (
        <div key={day.dateISO} className={`week-cell${day.isToday ? ' today' : ''}`}>
          <div className="daylabel">{new Date(`${day.dateISO}T00:00:00`).toLocaleDateString('en-US', { weekday: 'short' })}</div>
          {day.session && (
            <Badge variant={day.done ? 'amber' : 'default'}>
              {day.done ? '✓ ' : ''}{SESSION_TYPE_LABEL[day.session.session_type]}
            </Badge>
          )}
        </div>
      ))}
    </div>
  );
}
