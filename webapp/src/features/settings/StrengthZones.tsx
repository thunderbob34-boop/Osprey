import { useState, type ReactNode } from 'react';
import { useUserGoal, useUpdateGoalParams, useUnits } from './queries';
import { formatWeightKg, parseWeightInput, type UnitSystem } from '../../lib/units';
import { phaseOrBase, type RacePhaseName } from '../../lib/race-phase';
import { strengthWorkingLoads } from '../../lib/strength-loads';
import { crossfitStrengthLoads, ENERGY_SYSTEM_ZONES, BENCHMARK_BY_PHASE, franTier, type BenchmarkTier } from '../../lib/crossfit-zones';
import { hyroxStationWeights, compromisedSplitFromThresholdMile, HYROX_DIVISIONS, type HyroxDivision, type HyroxStationWeights } from '../../lib/hyrox-loads';
import { parseLiftParams, parseCrossfitParams, parseHyroxParams, validKg, validFranSec } from '../../lib/goal-params';
import { formatMinSec } from '../../lib/training-zones';
import { ErrorPanel } from '../../components/ErrorPanel';

// Strip formatWeightKg's unit suffix ("225 lbs" -> "225") to seed a bare-number input.
const bareWeight = (kg: number, units: UnitSystem) => formatWeightKg(kg, units).split(' ')[0];

// parseWeightInput has no upper bound; goal-params' posKg rejects >600kg on the next read,
// which would silently drop a save. Reject it here instead of letting it round-trip to null.
function parseValidWeightKg(text: string, units: UnitSystem): number | null {
  const kg = parseWeightInput(text, units);
  return kg != null && validKg(kg) ? kg : null;
}

function parseMinSec(text: string): number | null {
  const m = text.trim().match(/^(\d{1,3}):([0-5]\d)$/);
  if (!m) return null;
  const sec = Number(m[1]) * 60 + Number(m[2]);
  return validFranSec(sec) ? sec : null;
}

const DIVISION_LABEL: Record<HyroxDivision, string> = {
  open_men: 'Open Men',
  open_women: 'Open Women',
  pro_men: 'Pro Men',
  pro_women: 'Pro Women',
};

const STATION_LABEL: Record<keyof HyroxStationWeights, string> = {
  sledPushKg: 'Sled push',
  sledPullKg: 'Sled pull',
  farmersCarryPerHandKg: 'Farmers carry (per hand)',
  sandbagLungesKg: 'Sandbag lunges',
  wallBallKg: 'Wall ball',
};

const TIER_LABEL: Record<BenchmarkTier, string> = {
  beginner: 'Beginner',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
  elite: 'Elite',
};

export function StrengthZones({ userId }: { userId: string }) {
  const goal = useUserGoal(userId);
  const update = useUpdateGoalParams(userId);
  const units = useUnits(userId);

  if (!goal.data || !units.data || !['lift', 'crossfit', 'hyrox'].includes(goal.data.primaryGoal ?? '')) return null;

  const unitSystem: UnitSystem = units.data ?? 'imperial';
  const phase = phaseOrBase({
    targetRace: goal.data.targetRace,
    targetDate: goal.data.targetDate,
    totalWeeksPlanned: goal.data.totalWeeksPlanned,
  });
  const phaseLabel = goal.data.targetDate && goal.data.totalWeeksPlanned ? phase : 'Base — general prep';
  const save = (patch: Record<string, unknown>) => update.mutate(patch);

  return (
    <>
      {goal.data.primaryGoal === 'lift' && (
        <LiftZones goalParams={goal.data.goalParams} unitSystem={unitSystem} phase={phase} phaseLabel={phaseLabel} onSave={save} saving={update.isPending} />
      )}
      {goal.data.primaryGoal === 'crossfit' && (
        <CrossfitZones goalParams={goal.data.goalParams} unitSystem={unitSystem} phase={phase} phaseLabel={phaseLabel} onSave={save} saving={update.isPending} />
      )}
      {goal.data.primaryGoal === 'hyrox' && (
        <HyroxZones
          goalParams={goal.data.goalParams}
          thresholdSecPerMile={goal.data.thresholdAnchor.run?.thresholdSecPerMile ?? null}
          onSave={save}
          saving={update.isPending}
        />
      )}
      {update.error ? <ErrorPanel error={update.error} /> : null}
    </>
  );
}

// ---------- shared 1RM row (used by lift + crossfit) ----------

function LiftInputRow({
  label, unitSystem, value, onChange, onSave, saving, children,
}: {
  label: string;
  unitSystem: UnitSystem;
  value: string;
  onChange: (v: string) => void;
  onSave: (kg: number) => void;
  saving: boolean;
  children?: ReactNode;
}) {
  const kg = parseValidWeightKg(value, unitSystem);
  const err = value.trim() !== '' && kg == null;
  return (
    <div className="settings-row" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 8 }}>
      <strong>{label}</strong>
      <input
        style={{ width: 120 }}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={unitSystem === 'metric' ? 'kg' : 'lbs'}
        inputMode="decimal"
      />
      {children}
      {err ? <span className="err-line">Enter a positive number</span> : null}
      <div style={{ display: 'flex', gap: 8 }}>
        <button className="btn" type="button" disabled={saving || kg == null} onClick={() => { if (kg != null) onSave(kg); }}>
          Save
        </button>
      </div>
    </div>
  );
}

// ---------- lift ----------

function LiftZones({
  goalParams, unitSystem, phase, phaseLabel, onSave, saving,
}: {
  goalParams: unknown;
  unitSystem: UnitSystem;
  phase: RacePhaseName;
  phaseLabel: string;
  onSave: (patch: Record<string, unknown>) => void;
  saving: boolean;
}) {
  const stored = parseLiftParams(goalParams).oneRepMaxKg;
  const [squat, setSquat] = useState(() => (stored.squat != null ? bareWeight(stored.squat, unitSystem) : ''));
  const [bench, setBench] = useState(() => (stored.bench != null ? bareWeight(stored.bench, unitSystem) : ''));
  const [deadlift, setDeadlift] = useState(() => (stored.deadlift != null ? bareWeight(stored.deadlift, unitSystem) : ''));

  const effSquat = parseValidWeightKg(squat, unitSystem) ?? stored.squat;
  const effBench = parseValidWeightKg(bench, unitSystem) ?? stored.bench;
  const effDeadlift = parseValidWeightKg(deadlift, unitSystem) ?? stored.deadlift;
  const working = strengthWorkingLoads({ squat: effSquat, bench: effBench, deadlift: effDeadlift }, phase);

  const ladder = (orm: number | null) =>
    orm == null ? null : [70, 80, 90].map((p) => `${p}% ${formatWeightKg(Math.round((orm * p) / 100), unitSystem)}`).join(' · ');

  const rows: { key: 'squat' | 'bench' | 'deadlift'; label: string; value: string; setValue: (v: string) => void; eff: number | null; working: number }[] = [
    { key: 'squat', label: 'Squat', value: squat, setValue: setSquat, eff: effSquat, working: working.loads.squat },
    { key: 'bench', label: 'Bench', value: bench, setValue: setBench, eff: effBench, working: working.loads.bench },
    { key: 'deadlift', label: 'Deadlift', value: deadlift, setValue: setDeadlift, eff: effDeadlift, working: working.loads.deadlift },
  ];

  return (
    <div style={{ marginTop: 10, paddingTop: 18, borderTop: '1px solid #232329' }}>
      <h3>Strength</h3>
      <p style={{ color: 'var(--mut)' }}>
        Phase: {phaseLabel}. Working loads and zones are computed from your current 1RMs.
      </p>
      {rows.map((row) => (
        <LiftInputRow key={row.key} label={row.label} unitSystem={unitSystem} value={row.value} onChange={row.setValue} saving={saving} onSave={(kg) => onSave({ oneRepMaxKg: { [row.key]: kg } })}>
          {row.eff != null ? (
            <div style={{ color: 'var(--mut)' }}>
              Working {formatWeightKg(row.working, unitSystem)} · {working.workingPercent1RM}% 1RM · {working.zoneName}
              <br />
              Ladder — {ladder(row.eff)}
            </div>
          ) : (
            <p style={{ color: 'var(--mut)' }}>Not set — enter your {row.label.toLowerCase()} 1RM to see working loads and zones.</p>
          )}
        </LiftInputRow>
      ))}
    </div>
  );
}

// ---------- crossfit ----------

function CrossfitZones({
  goalParams, unitSystem, phase, phaseLabel, onSave, saving,
}: {
  goalParams: unknown;
  unitSystem: UnitSystem;
  phase: RacePhaseName;
  phaseLabel: string;
  onSave: (patch: Record<string, unknown>) => void;
  saving: boolean;
}) {
  const stored = parseCrossfitParams(goalParams);
  const [backSquat, setBackSquat] = useState(() => (stored.oneRepMaxKg.backSquat != null ? bareWeight(stored.oneRepMaxKg.backSquat, unitSystem) : ''));
  const [deadlift, setDeadlift] = useState(() => (stored.oneRepMaxKg.deadlift != null ? bareWeight(stored.oneRepMaxKg.deadlift, unitSystem) : ''));
  const [press, setPress] = useState(() => (stored.oneRepMaxKg.press != null ? bareWeight(stored.oneRepMaxKg.press, unitSystem) : ''));
  const [fran, setFran] = useState(() => (stored.franSec != null ? formatMinSec(stored.franSec) : ''));

  const effBackSquat = parseValidWeightKg(backSquat, unitSystem) ?? stored.oneRepMaxKg.backSquat;
  const effDeadlift = parseValidWeightKg(deadlift, unitSystem) ?? stored.oneRepMaxKg.deadlift;
  const effPress = parseValidWeightKg(press, unitSystem) ?? stored.oneRepMaxKg.press;
  const working = crossfitStrengthLoads({ backSquat: effBackSquat, deadlift: effDeadlift, press: effPress }, phase);

  const liveFranSec = parseMinSec(fran);
  const franErr = fran.trim() !== '' && liveFranSec == null;
  const effFranSec = liveFranSec ?? stored.franSec;
  const tier = effFranSec != null ? franTier(effFranSec) : null;

  const rows: { key: 'backSquat' | 'deadlift' | 'press'; label: string; value: string; setValue: (v: string) => void; eff: number | null; working: number }[] = [
    { key: 'backSquat', label: 'Back squat', value: backSquat, setValue: setBackSquat, eff: effBackSquat, working: working.loads.backSquat },
    { key: 'deadlift', label: 'Deadlift', value: deadlift, setValue: setDeadlift, eff: effDeadlift, working: working.loads.deadlift },
    { key: 'press', label: 'Press', value: press, setValue: setPress, eff: effPress, working: working.loads.press },
  ];

  return (
    <div style={{ marginTop: 10, paddingTop: 18, borderTop: '1px solid #232329' }}>
      <h3>CrossFit</h3>
      <p style={{ color: 'var(--mut)' }}>Phase: {phaseLabel}.</p>

      {rows.map((row) => (
        <LiftInputRow key={row.key} label={row.label} unitSystem={unitSystem} value={row.value} onChange={row.setValue} saving={saving} onSave={(kg) => onSave({ oneRepMaxKg: { [row.key]: kg } })}>
          {row.eff != null ? (
            <div style={{ color: 'var(--mut)' }}>
              Working {formatWeightKg(row.working, unitSystem)} · {working.workingPercent1RM}% 1RM · {working.zoneName}
            </div>
          ) : (
            <p style={{ color: 'var(--mut)' }}>Not set — enter your {row.label.toLowerCase()} 1RM to see working loads.</p>
          )}
        </LiftInputRow>
      ))}

      <div className="settings-row" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 8 }}>
        <strong>Fran time</strong>
        <input style={{ width: 100 }} value={fran} onChange={(e) => setFran(e.target.value)} placeholder="m:ss" />
        {franErr ? <span className="err-line">Enter time as m:ss (e.g. 3:45)</span> : null}
        {tier ? <div style={{ color: 'var(--mut)' }}>Tier: {TIER_LABEL[tier]}</div> : <p style={{ color: 'var(--mut)' }}>Not set — enter your Fran time to see your benchmark tier.</p>}
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn" type="button" disabled={saving || liveFranSec == null} onClick={() => { if (liveFranSec != null) onSave({ franSec: liveFranSec }); }}>
            Save
          </button>
        </div>
      </div>

      <div className="settings-row">
        <span className="k">Competing</span>
        <div className="toggle-group">
          <button type="button" className={stored.competing ? '' : 'active'} disabled={saving} onClick={() => onSave({ competing: false })}>No</button>
          <button type="button" className={stored.competing ? 'active' : ''} disabled={saving} onClick={() => onSave({ competing: true })}>Yes</button>
        </div>
      </div>

      <div style={{ marginTop: 14 }}>
        <strong>Energy systems</strong>
        <table className="predictor-table">
          <thead>
            <tr><th>System</th><th>Duration</th><th>Work:Rest</th><th>Purpose</th></tr>
          </thead>
          <tbody>
            {ENERGY_SYSTEM_ZONES.map((z) => (
              <tr key={z.system}>
                <td>{z.system}</td>
                <td>{z.minDurationSec}–{z.maxDurationSec ?? '∞'}s</td>
                <td>{z.workToRest}</td>
                <td>{z.purpose}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p style={{ color: 'var(--mut)', marginTop: 12 }}>Phase benchmark: {BENCHMARK_BY_PHASE[phase]}</p>
    </div>
  );
}

// ---------- hyrox ----------

function HyroxZones({
  goalParams, thresholdSecPerMile, onSave, saving,
}: {
  goalParams: unknown;
  thresholdSecPerMile: number | null;
  onSave: (patch: Record<string, unknown>) => void;
  saving: boolean;
}) {
  const { division } = parseHyroxParams(goalParams);

  return (
    <div style={{ marginTop: 10, paddingTop: 18, borderTop: '1px solid #232329' }}>
      <h3>Hyrox</h3>

      <div className="settings-row">
        <span className="k">Division</span>
        <select
          value={division ?? ''}
          disabled={saving}
          onChange={(e) => { if (e.target.value) onSave({ division: e.target.value }); }}
        >
          <option value="" disabled>Select division…</option>
          {HYROX_DIVISIONS.map((d) => (
            <option key={d} value={d}>{DIVISION_LABEL[d]}</option>
          ))}
        </select>
      </div>

      <div className="settings-row" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 8 }}>
        <strong>Station weights</strong>
        {division ? (
          (() => {
            const weights = hyroxStationWeights(division);
            return (
              <table className="predictor-table">
                <tbody>
                  {(Object.keys(weights) as (keyof HyroxStationWeights)[]).map((k) => (
                    <tr key={k}><td>{STATION_LABEL[k]}</td><td className="num">{weights[k]} kg</td></tr>
                  ))}
                </tbody>
              </table>
            );
          })()
        ) : (
          <p style={{ color: 'var(--mut)' }}>Pick your division above to see station weights.</p>
        )}
      </div>

      <div className="settings-row" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 8 }}>
        <strong>Compromised run pace</strong>
        {thresholdSecPerMile != null ? (
          (() => {
            const split = compromisedSplitFromThresholdMile(thresholdSecPerMile);
            return <div style={{ color: 'var(--mut)' }}>{formatMinSec(split.min)}–{formatMinSec(split.max)} /km off the station work</div>;
          })()
        ) : (
          <p style={{ color: 'var(--mut)' }}>Set your Run anchor above to see your predicted compromised pace.</p>
        )}
      </div>
    </div>
  );
}
