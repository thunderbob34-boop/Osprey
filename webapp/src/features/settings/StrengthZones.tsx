import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useUserGoal, useUpdateGoalParams, useUnits } from './queries';
import { formatWeightKg, parseWeightInput, type UnitSystem } from '../../lib/units';
import { phaseOrBase, type RacePhaseName } from '../../lib/race-phase';
import { strengthWorkingLoads } from '../../lib/strength-loads';
import { crossfitStrengthLoads, ENERGY_SYSTEM_ZONES, BENCHMARK_BY_PHASE, franTier, type BenchmarkTier } from '../../lib/crossfit-zones';
import { hyroxStationWeights, compromisedSplitFromThresholdMile, HYROX_DIVISIONS, MILES_PER_KM, type HyroxDivision, type HyroxStationWeights } from '../../lib/hyrox-loads';
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

// A weight-input string seeded from the stored kg value, re-seeded (after the
// initial mount) whenever the unit system or the stored kg value itself changes —
// otherwise a value typed in one unit system is silently reinterpreted in another
// after a units toggle. A same-value refetch is a no-op (React skips the effect),
// so an in-progress edit in an unrelated sibling field is untouched.
function useWeightInputState(storedKg: number | null, unitSystem: UnitSystem): [string, (v: string) => void] {
  const [value, setValue] = useState(() => (storedKg != null ? bareWeight(storedKg, unitSystem) : ''));
  const mounted = useRef(false);
  useEffect(() => {
    if (mounted.current) setValue(storedKg != null ? bareWeight(storedKg, unitSystem) : '');
    mounted.current = true;
  }, [unitSystem, storedKg]);
  return [value, setValue];
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
          unitSystem={unitSystem}
          phaseLabel={phaseLabel}
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
  label, unitSystem, value, onChange, onSave, onClear, hasStored, saving, children,
}: {
  label: string;
  unitSystem: UnitSystem;
  value: string;
  onChange: (v: string) => void;
  onSave: (kg: number) => void;
  onClear: () => void;
  hasStored: boolean;
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
        {hasStored && <button className="btn" type="button" disabled={saving} onClick={onClear}>Clear</button>}
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
  const [squat, setSquat] = useWeightInputState(stored.squat, unitSystem);
  const [bench, setBench] = useWeightInputState(stored.bench, unitSystem);
  const [deadlift, setDeadlift] = useWeightInputState(stored.deadlift, unitSystem);

  const effSquat = parseValidWeightKg(squat, unitSystem) ?? stored.squat;
  const effBench = parseValidWeightKg(bench, unitSystem) ?? stored.bench;
  const effDeadlift = parseValidWeightKg(deadlift, unitSystem) ?? stored.deadlift;
  const working = strengthWorkingLoads({ squat: effSquat, bench: effBench, deadlift: effDeadlift }, phase);

  const ladder = (orm: number | null) =>
    orm == null ? null : [70, 80, 90].map((p) => `${p}% ${formatWeightKg(Math.round((orm * p) / 100), unitSystem)}`).join(' · ');

  const rows: { key: 'squat' | 'bench' | 'deadlift'; label: string; value: string; setValue: (v: string) => void; eff: number | null; hasStored: boolean; working: number }[] = [
    { key: 'squat', label: 'Squat', value: squat, setValue: setSquat, eff: effSquat, hasStored: stored.squat != null, working: working.loads.squat },
    { key: 'bench', label: 'Bench', value: bench, setValue: setBench, eff: effBench, hasStored: stored.bench != null, working: working.loads.bench },
    { key: 'deadlift', label: 'Deadlift', value: deadlift, setValue: setDeadlift, eff: effDeadlift, hasStored: stored.deadlift != null, working: working.loads.deadlift },
  ];

  return (
    <div style={{ marginTop: 10, paddingTop: 18, borderTop: '1px solid #232329' }}>
      <h3>Strength</h3>
      <p style={{ color: 'var(--mut)' }}>
        Phase: {phaseLabel}. Working loads and zones are computed from your current 1RMs.
      </p>
      {rows.map((row) => (
        <LiftInputRow key={row.key} label={row.label} unitSystem={unitSystem} value={row.value} onChange={row.setValue} saving={saving} hasStored={row.hasStored} onSave={(kg) => onSave({ oneRepMaxKg: { [row.key]: kg } })} onClear={() => onSave({ oneRepMaxKg: { [row.key]: null } })}>
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
  const [backSquat, setBackSquat] = useWeightInputState(stored.oneRepMaxKg.backSquat, unitSystem);
  const [deadlift, setDeadlift] = useWeightInputState(stored.oneRepMaxKg.deadlift, unitSystem);
  const [press, setPress] = useWeightInputState(stored.oneRepMaxKg.press, unitSystem);
  const [fran, setFran] = useState(() => (stored.franSec != null ? formatMinSec(stored.franSec) : ''));

  const effBackSquat = parseValidWeightKg(backSquat, unitSystem) ?? stored.oneRepMaxKg.backSquat;
  const effDeadlift = parseValidWeightKg(deadlift, unitSystem) ?? stored.oneRepMaxKg.deadlift;
  const effPress = parseValidWeightKg(press, unitSystem) ?? stored.oneRepMaxKg.press;
  const working = crossfitStrengthLoads({ backSquat: effBackSquat, deadlift: effDeadlift, press: effPress }, phase);

  const liveFranSec = parseMinSec(fran);
  const franErr = fran.trim() !== '' && liveFranSec == null;
  const effFranSec = liveFranSec ?? stored.franSec;
  const tier = effFranSec != null ? franTier(effFranSec) : null;

  const rows: { key: 'backSquat' | 'deadlift' | 'press'; label: string; value: string; setValue: (v: string) => void; eff: number | null; hasStored: boolean; working: number }[] = [
    { key: 'backSquat', label: 'Back squat', value: backSquat, setValue: setBackSquat, eff: effBackSquat, hasStored: stored.oneRepMaxKg.backSquat != null, working: working.loads.backSquat },
    { key: 'deadlift', label: 'Deadlift', value: deadlift, setValue: setDeadlift, eff: effDeadlift, hasStored: stored.oneRepMaxKg.deadlift != null, working: working.loads.deadlift },
    { key: 'press', label: 'Press', value: press, setValue: setPress, eff: effPress, hasStored: stored.oneRepMaxKg.press != null, working: working.loads.press },
  ];

  return (
    <div style={{ marginTop: 10, paddingTop: 18, borderTop: '1px solid #232329' }}>
      <h3>CrossFit</h3>
      <p style={{ color: 'var(--mut)' }}>Phase: {phaseLabel}.</p>

      {rows.map((row) => (
        <LiftInputRow key={row.key} label={row.label} unitSystem={unitSystem} value={row.value} onChange={row.setValue} saving={saving} hasStored={row.hasStored} onSave={(kg) => onSave({ oneRepMaxKg: { [row.key]: kg } })} onClear={() => onSave({ oneRepMaxKg: { [row.key]: null } })}>
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
          {stored.franSec != null && (
            <button className="btn" type="button" disabled={saving} onClick={() => onSave({ franSec: null })}>Clear</button>
          )}
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
  goalParams, thresholdSecPerMile, unitSystem, phaseLabel, onSave, saving,
}: {
  goalParams: unknown;
  thresholdSecPerMile: number | null;
  unitSystem: UnitSystem;
  phaseLabel: string;
  onSave: (patch: Record<string, unknown>) => void;
  saving: boolean;
}) {
  const { division } = parseHyroxParams(goalParams);

  return (
    <div style={{ marginTop: 10, paddingTop: 18, borderTop: '1px solid #232329' }}>
      <h3>Hyrox</h3>
      <p style={{ color: 'var(--mut)' }}>Phase: {phaseLabel}.</p>

      <div className="settings-row">
        <label className="k" htmlFor="se-hyrox-division">Division</label>
        <select
          id="se-hyrox-division"
          value={division ?? ''}
          disabled={saving}
          onChange={(e) => { if (e.target.value) onSave({ division: e.target.value }); }}
        >
          <option value="" disabled>Select division…</option>
          {HYROX_DIVISIONS.map((d) => (
            <option key={d} value={d}>{DIVISION_LABEL[d]}</option>
          ))}
        </select>
        {division && (
          <button className="btn" type="button" disabled={saving} onClick={() => onSave({ division: null })}>Clear</button>
        )}
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
            // The predictor works in sec/km (the blueprint's compromised-pace unit); convert to
            // sec/mile for imperial athletes so it matches every other pace shown in the app.
            const shown = unitSystem === 'imperial'
              ? { min: split.min / MILES_PER_KM, max: split.max / MILES_PER_KM }
              : split;
            const unit = unitSystem === 'imperial' ? '/mi' : '/km';
            return <div style={{ color: 'var(--mut)' }}>{formatMinSec(Math.round(shown.min))}–{formatMinSec(Math.round(shown.max))} {unit} off the station work</div>;
          })()
        ) : (
          <p style={{ color: 'var(--mut)' }}>Set your Run anchor above to see your predicted compromised pace.</p>
        )}
      </div>
    </div>
  );
}
