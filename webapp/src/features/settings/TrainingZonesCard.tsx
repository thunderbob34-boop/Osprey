import { useState } from 'react';
import { useThresholdAnchor, useUpdateThresholdAnchor } from './queries';
import { setAnchorEntry, clearAnchorEntry, type AnchorKey, type ThresholdAnchorMap } from '../../lib/threshold-anchor';
import { parseSwimBaseline, parseRowingBaseline, parseRunBaseline, parseFTPBaseline } from '../../lib/baseline';
import { swimPaceZones, runningPaceZones, rowingTrainingZones, cyclingPowerZones, formatMinSec, type Range } from '../../lib/training-zones';
import { ErrorPanel } from '../../components/ErrorPanel';

const num = (s: string) => (s.trim() === '' ? NaN : Number(s));
const mmss = (m: string, s: string) => num(m) * 60 + num(s);
const band = (r: Range, unit: string) =>
  r.min == null ? `≤ ${formatMinSec(r.max as number)} ${unit}` : r.max == null ? `≥ ${formatMinSec(r.min)} ${unit}` : `${formatMinSec(r.min)}–${formatMinSec(r.max)} ${unit}`;

type Row = { key: AnchorKey; title: string };
const ROWS: Row[] = [
  { key: 'run', title: 'Run' },
  { key: 'swim', title: 'Swim' },
  { key: 'row', title: 'Rowing' },
  { key: 'bike', title: 'Cycling' },
];

export function TrainingZonesCard({ userId }: { userId: string }) {
  const anchor = useThresholdAnchor(userId);
  const update = useUpdateThresholdAnchor(userId);
  if (anchor.isLoading) return <div className="card">Loading zones…</div>;
  if (anchor.error) return <ErrorPanel error={anchor.error} />;
  const map = anchor.data ?? {};

  return (
    <div className="card">
      <h3>Training Zones</h3>
      <p style={{ color: 'var(--mut)' }}>Set your anchor per sport. These drive the paces in your generated plan.</p>
      {ROWS.map((row) => (
        <SportZone key={row.key} row={row} map={map} onSave={(next) => update.mutate(next)} saving={update.isPending} />
      ))}
      {update.error ? <ErrorPanel error={update.error} /> : null}
    </div>
  );
}

function SportZone({ row, map, onSave, saving }: { row: Row; map: ThresholdAnchorMap; onSave: (m: ThresholdAnchorMap) => void; saving: boolean }) {
  const entry = map[row.key];
  const [a, setA] = useState(''); const [b, setB] = useState('');
  const [c, setC] = useState(''); const [d, setD] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Parse current inputs → the anchor value (or null) for a live preview.
  let preview: number | null = null;
  if (row.key === 'swim') { const r = parseSwimBaseline(mmss(a, b), mmss(c, d)); if (r.ok) preview = r.value; }
  else if (row.key === 'row') { const r = parseRowingBaseline(mmss(a, b)); if (r.ok) preview = r.value; }
  else if (row.key === 'bike') { const r = parseFTPBaseline(num(a)); if (r.ok) preview = r.value; }
  else { const r = parseRunBaseline(num(a), mmss(c, d)); if (r.ok) preview = r.value; }

  const stored = row.key === 'swim' ? entry && 'cssSecPer100' in entry ? entry.cssSecPer100 : null
    : row.key === 'row' ? entry && 'splitSecPer500' in entry ? entry.splitSecPer500 : null
    : row.key === 'bike' ? (entry && 'ftpWatts' in entry ? entry.ftpWatts : null)
    : entry && 'thresholdSecPerMile' in entry ? entry.thresholdSecPerMile : null;
  const shown = preview ?? stored;

  function save() {
    setError(null);
    let value: number; let payload: NonNullable<ThresholdAnchorMap[AnchorKey]>;
    if (row.key === 'swim') { const r = parseSwimBaseline(mmss(a, b), mmss(c, d)); if (!r.ok) return setError(r.error); value = r.value; payload = { cssSecPer100: value, source: 'self_report' }; }
    else if (row.key === 'row') { const r = parseRowingBaseline(mmss(a, b)); if (!r.ok) return setError(r.error); value = r.value; payload = { splitSecPer500: value, source: 'self_report' }; }
    else if (row.key === 'bike') { const r = parseFTPBaseline(num(a)); if (!r.ok) return setError(r.error); value = r.value; payload = { ftpWatts: value, source: 'self_report' }; }
    else { const r = parseRunBaseline(num(a), mmss(c, d)); if (!r.ok) return setError(r.error); value = r.value; payload = { thresholdSecPerMile: value, source: 'self_report' }; }
    onSave(setAnchorEntry(map, row.key, payload));
  }

  return (
    <div className="settings-row" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 8 }}>
      <strong>{row.title}</strong>
      {row.key === 'swim' && <><TimeInput label="400m" m={a} s={b} setM={setA} setS={setB} /><TimeInput label="200m" m={c} s={d} setM={setC} setS={setD} /></>}
      {row.key === 'row' && <TimeInput label="2k" m={a} s={b} setM={setA} setS={setB} />}
      {row.key === 'bike' && <input placeholder="FTP (watts)" value={a} onChange={(e) => setA(e.target.value)} inputMode="numeric" />}
      {row.key === 'run' && <><input placeholder="distance (mi)" value={a} onChange={(e) => setA(e.target.value)} inputMode="decimal" /><TimeInput label="time" m={c} s={d} setM={setC} setS={setD} /></>}

      {shown != null && <ZonePreview sportKey={row.key} value={shown} />}
      {stored == null && preview == null && <p style={{ color: 'var(--mut)' }}>Not set — Ozzie estimates these from your training. Enter your numbers to set them precisely.</p>}

      {error ? <span className="err-line">{error}</span> : null}
      <div style={{ display: 'flex', gap: 8 }}>
        <button className="btn" type="button" disabled={saving || preview == null} onClick={save}>Save</button>
        {entry && <button className="btn" type="button" disabled={saving} onClick={() => onSave(clearAnchorEntry(map, row.key))}>Clear</button>}
      </div>
    </div>
  );
}

function ZonePreview({ sportKey, value }: { sportKey: AnchorKey; value: number }) {
  if (sportKey === 'swim') { const z = swimPaceZones(value); return <div style={{ color: 'var(--mut)' }}>CSS {value}s/100m · aerobic {band(z.z2Aerobic, 's/100m')} · threshold {band(z.z3Threshold, 's/100m')}</div>; }
  if (sportKey === 'row') { const z = rowingTrainingZones(value); return <div style={{ color: 'var(--mut)' }}>2k split {value}s/500m · UT2 {band(z.ut2.splitSecPer500, 's/500m')} · AT {band(z.at.splitSecPer500, 's/500m')}</div>; }
  if (sportKey === 'bike') { const z = cyclingPowerZones(value); return <div style={{ color: 'var(--mut)' }}>FTP {value}w · endurance {z.z2Endurance.min}-{z.z2Endurance.max}w · threshold {z.z4Threshold.min}-{z.z4Threshold.max}w</div>; }
  const z = runningPaceZones(value); return <div style={{ color: 'var(--mut)' }}>Threshold {formatMinSec(value)}/mi · easy {band(z.easy, '/mi')} · 5K {band(z.fiveKPace, '/mi')}</div>;
}

function TimeInput({ label, m, s, setM, setS }: { label: string; m: string; s: string; setM: (v: string) => void; setS: (v: string) => void }) {
  return (
    <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
      <span style={{ color: 'var(--mut)', width: 48 }}>{label}</span>
      <input style={{ width: 60 }} placeholder="min" value={m} onChange={(e) => setM(e.target.value)} inputMode="numeric" />
      <span>:</span>
      <input style={{ width: 60 }} placeholder="sec" value={s} onChange={(e) => setS(e.target.value)} inputMode="numeric" />
    </span>
  );
}
