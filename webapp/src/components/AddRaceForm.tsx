import { useState, type FormEvent } from 'react';
import { useCreateRaceEvent } from '../features/races/queries';

interface Props {
  userId: string;
  defaultDate?: string;
  onDone: () => void;
}

export function AddRaceForm({ userId, defaultDate, onDone }: Props) {
  const create = useCreateRaceEvent(userId);
  const [name, setName] = useState('');
  const [eventDate, setEventDate] = useState(defaultDate ?? '');
  const [distanceKm, setDistanceKm] = useState('');
  const [raceUrl, setRaceUrl] = useState('');

  async function submit(e: FormEvent) {
    e.preventDefault();
    await create.mutateAsync({
      name,
      eventDate,
      distanceKm: distanceKm.trim() ? Number(distanceKm) : null,
      raceUrl: raceUrl.trim() || null,
      notes: null,
    });
    onDone();
  }

  return (
    <form onSubmit={(e) => void submit(e)}>
      <div className="log-form" style={{ marginBottom: 14 }}>
        <div className="field span-full">
          <label htmlFor="race-name">Race name</label>
          <input id="race-name" value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div className="field">
          <label htmlFor="race-date">Date</label>
          <input id="race-date" type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} required />
        </div>
        <div className="field">
          <label htmlFor="race-distance">Distance (km)</label>
          <input id="race-distance" type="number" step="0.1" min="0" value={distanceKm} onChange={(e) => setDistanceKm(e.target.value)} />
        </div>
        <div className="field span-full">
          <label htmlFor="race-url">Race URL (optional)</label>
          <input id="race-url" type="url" value={raceUrl} onChange={(e) => setRaceUrl(e.target.value)} placeholder="https://…" />
        </div>
      </div>
      {create.isError && <p className="err-line" role="alert" style={{ marginBottom: 12 }}>{(create.error as Error).message}</p>}
      <div className="log-form-actions">
        <button className="btn" type="submit" disabled={create.isPending}>{create.isPending ? 'Saving…' : 'Add race'}</button>
      </div>
    </form>
  );
}
