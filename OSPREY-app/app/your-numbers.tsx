import { ActivityIndicator, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Theme } from '@/constants/theme';
import { Card } from '@/components/ui';
import ScreenHeader from '@/components/ScreenHeader';
import { useDisplayEnvelope, type DisplayEnvelope } from '@/hooks/useDisplayEnvelope';
import { intRange } from '@/services/pace-format';
import type { FuelPlan } from '@/services/coaching/fuel';
import type { EnduranceDayType } from '@/services/calculators/shared';
import { useTrainingGoal } from '@/hooks/useTrainingGoal';
import { useUnitPreference } from '@/hooks/useUnitPreference';
import { formatWeightKg, type UnitSystem } from '@/services/units';
import { kgToLb } from '@/services/body-metrics';
import { formatMinSec, type Range } from '@/services/calculators/types';
import { prescriptionSectionForSport } from '@/services/coaching/prescription-section';
import type { PrimaryGoalEnum } from '@/services/coaching/goal-map';
import type { StrengthPrescription } from '@/services/coaching/strength';
import type { HyroxPrescription } from '@/services/coaching/hyrox';
import type { HyroxDivision, HyroxStationWeights } from '@/services/calculators/hyrox';
import type { CrossfitPrescription } from '@/services/coaching/crossfit';
import type { BenchmarkTier } from '@/services/calculators/crossfit';

const DAY_TYPE_LABEL: Record<EnduranceDayType, string> = {
  easy: 'Easy days',
  moderate: 'Moderate days',
  high: 'High-volume days',
  peak: 'Peak / race week',
};

const DAY_TYPES: EnduranceDayType[] = ['easy', 'moderate', 'high', 'peak'];

const IN_SESSION_LABEL: Record<string, string> = {
  run: 'on long runs',
  hybrid: 'on long runs',
  ultra: 'on long runs',
  cycling: 'on long rides',
  swim: 'on meet day',
  triathlon: 'on race day',
  hyrox: 'on race day',
  crossfit: 'on long metcons',
};

export default function YourNumbersScreen() {
  const display = useDisplayEnvelope();
  const { data: goal } = useTrainingGoal();
  const { units } = useUnitPreference();

  if (!display) {
    return (
      <SafeAreaView style={styles.container}>
        <ScreenHeader title="Your Numbers" />
        <ActivityIndicator color={Theme.accent} style={{ marginTop: 32 }} />
      </SafeAreaView>
    );
  }

  const primaryGoal = (goal?.primaryGoal ?? null) as PrimaryGoalEnum | null;
  const section = prescriptionSectionForSport(primaryGoal);

  return (
    <SafeAreaView style={styles.container}>
      <ScreenHeader title="Your Numbers" />
      <ScrollView contentContainerStyle={styles.scroll}>
        <TrainingContextSection envelope={display} />
        {section === 'strength' ? <StrengthSection strength={display.strength} units={units} /> : null}
        {section === 'hyrox' ? <HyroxSection hyrox={display.hyrox} units={units} /> : null}
        {section === 'crossfit' ? <CrossfitSection crossfit={display.crossfit} units={units} /> : null}
        <FuelSection fuel={display.fuel} sport={display.sport} />
      </ScrollView>
    </SafeAreaView>
  );
}

function TrainingContextSection({ envelope }: { envelope: DisplayEnvelope }) {
  return (
    <Card style={styles.cardGap}>
      <Text style={styles.sectionLabel}>TRAINING CONTEXT</Text>
      <View style={styles.contextRow}>
        <Text style={styles.contextLabel}>Phase</Text>
        <Text style={styles.contextValue}>{envelope.phase}</Text>
      </View>
      <View style={styles.contextRow}>
        <Text style={styles.contextLabel}>Week</Text>
        <Text style={styles.contextValue}>{envelope.weekNumber} of {envelope.totalWeeks}</Text>
      </View>
      <View style={styles.contextRow}>
        <Text style={styles.contextLabel}>Target weekly load</Text>
        <Text style={styles.contextValue}>{envelope.targetWeeklyLoad}</Text>
      </View>
    </Card>
  );
}

function FuelSection({ fuel, sport }: { fuel: FuelPlan; sport: string }) {
  const inSessionLabel = IN_SESSION_LABEL[sport] ?? 'in long sessions';
  return (
    <Card style={styles.cardGap}>
      <Text style={styles.sectionLabel}>FUEL</Text>
      {DAY_TYPES.map((dt) => (
        <View key={dt} style={styles.contextRow}>
          <Text style={styles.contextLabel}>{DAY_TYPE_LABEL[dt]}</Text>
          <Text style={styles.contextValue}>{intRange(fuel.dailyCarbGByDayType[dt], 'g carbs')}</Text>
        </View>
      ))}
      <View style={styles.contextRow}>
        <Text style={styles.contextLabel}>Protein</Text>
        <Text style={styles.contextValue}>{intRange(fuel.proteinG, 'g')}</Text>
      </View>
      {fuel.longSessionCarbGPerHour > 0 ? (
        <View style={styles.contextRow}>
          <Text style={styles.contextLabel}>In-session, {inSessionLabel}</Text>
          <Text style={styles.contextValue}>{fuel.longSessionCarbGPerHour} g/hr</Text>
        </View>
      ) : null}
    </Card>
  );
}

/** kg range -> one unit-aware string ("185–195 kg" / "408–430 lbs"), sharing
 *  one unit suffix rather than repeating it per bound. Mirrors formatWeightKg's
 *  own per-unit-system rounding (kgToLb already rounds to 1 decimal). */
function weightRange(range: Range, units: UnitSystem): string {
  if (range.min == null || range.max == null) return '—';
  if (units === 'metric') return `${Math.round(range.min * 10) / 10}–${Math.round(range.max * 10) / 10} kg`;
  return `${kgToLb(range.min)}–${kgToLb(range.max)} lbs`;
}

function secRange(range: Range, suffix: string): string {
  if (range.min == null || range.max == null) return '—';
  return `${formatMinSec(range.min)}–${formatMinSec(range.max)}${suffix}`;
}

const STRENGTH_LIFTS: { key: 'squat' | 'bench' | 'deadlift'; label: string }[] = [
  { key: 'squat', label: 'Squat' },
  { key: 'bench', label: 'Bench' },
  { key: 'deadlift', label: 'Deadlift' },
];

function StrengthSection({ strength, units }: { strength: StrengthPrescription | null; units: UnitSystem }) {
  if (!strength) {
    return (
      <Card style={styles.cardGap}>
        <Text style={styles.sectionLabel}>STRENGTH</Text>
        <Text style={styles.hint}>Not set — enter your squat, bench, and deadlift 1RMs in Preferences to see your working loads and zones.</Text>
      </Card>
    );
  }
  return (
    <Card style={styles.cardGap}>
      <Text style={styles.sectionLabel}>STRENGTH</Text>
      <Text style={styles.hint}>{strength.zone.name} · {strength.workingPercent1RM}% 1RM</Text>
      {STRENGTH_LIFTS.map(({ key, label }) => (
        <View key={key} style={styles.contextRow}>
          <Text style={styles.contextLabel}>{label}</Text>
          <Text style={styles.contextValue}>
            {strength.oneRepMaxKg[key] > 0
              ? formatWeightKg(Math.round((strength.oneRepMaxKg[key] * strength.workingPercent1RM) / 100), units)
              : 'Not set'}
          </Text>
        </View>
      ))}
      <View style={styles.contextRow}>
        <Text style={styles.contextLabel}>Reps</Text>
        <Text style={styles.contextValue}>{strength.zone.reps[0]}–{strength.zone.reps[1]}</Text>
      </View>
      <View style={styles.contextRow}>
        <Text style={styles.contextLabel}>RPE</Text>
        <Text style={styles.contextValue}>{strength.zone.rpe[0]}–{strength.zone.rpe[1]}</Text>
      </View>
      <View style={styles.contextRow}>
        <Text style={styles.contextLabel}>RIR</Text>
        <Text style={styles.contextValue}>{strength.zone.rir[0]}–{strength.zone.rir[1]}</Text>
      </View>
      <View style={styles.contextRow}>
        <Text style={styles.contextLabel}>Prilepin reps/set</Text>
        <Text style={styles.contextValue}>{strength.prilepin.repsPerSet[0]}–{strength.prilepin.repsPerSet[1]}</Text>
      </View>
      <View style={styles.contextRow}>
        <Text style={styles.contextLabel}>Prilepin total reps</Text>
        <Text style={styles.contextValue}>{strength.prilepin.totalReps[0]}–{strength.prilepin.totalReps[1]}</Text>
      </View>
      <View style={styles.contextRow}>
        <Text style={styles.contextLabel}>Daily fat target</Text>
        <Text style={styles.contextValue}>{intRange(strength.fatG, 'g')}</Text>
      </View>
      {strength.attempts ? (
        <>
          <Text style={styles.subLabel}>ATTEMPT PLAN</Text>
          {STRENGTH_LIFTS.map(({ key, label }) => {
            const plan = strength.attempts![key];
            return (
              <View key={key} style={styles.attemptBlock}>
                <Text style={styles.contextLabel}>{label}</Text>
                <Text style={styles.hint}>
                  Opener {weightRange(plan.opener, units)} · Second {weightRange(plan.second, units)} · Third {weightRange(plan.third, units)}
                </Text>
              </View>
            );
          })}
        </>
      ) : null}
    </Card>
  );
}

const HYROX_DIVISION_LABEL: Record<HyroxDivision, string> = {
  open_men: 'Open Men',
  open_women: 'Open Women',
  pro_men: 'Pro Men',
  pro_women: 'Pro Women',
  doubles_men: 'Doubles Men',
  doubles_women: 'Doubles Women',
  doubles_mixed: 'Doubles Mixed',
};

const HYROX_STATION_LABEL: Record<keyof HyroxStationWeights, string> = {
  sledPushKg: 'Sled push',
  sledPullKg: 'Sled pull',
  farmersCarryPerHandKg: 'Farmers carry (per hand)',
  sandbagLungesKg: 'Sandbag lunges',
  wallBallKg: 'Wall ball',
};

function HyroxSection({ hyrox, units }: { hyrox: HyroxPrescription | null; units: UnitSystem }) {
  if (!hyrox) {
    return (
      <Card style={styles.cardGap}>
        <Text style={styles.sectionLabel}>HYROX</Text>
        <Text style={styles.hint}>Not set — pick your division in Preferences to see your station weights and compromised run pace.</Text>
      </Card>
    );
  }
  return (
    <Card style={styles.cardGap}>
      <Text style={styles.sectionLabel}>HYROX</Text>
      <View style={styles.contextRow}>
        <Text style={styles.contextLabel}>Division</Text>
        <Text style={styles.contextValue}>{HYROX_DIVISION_LABEL[hyrox.division]}</Text>
      </View>
      <View style={styles.contextRow}>
        <Text style={styles.contextLabel}>Compromised run pace</Text>
        <Text style={styles.contextValue}>{secRange(hyrox.compromisedRunSplitSecPerKm, '/km')}</Text>
      </View>
      <Text style={styles.subLabel}>STATION WEIGHTS</Text>
      {(Object.keys(hyrox.stationWeights) as (keyof HyroxStationWeights)[]).map((key) => (
        <View key={key} style={styles.contextRow}>
          <Text style={styles.contextLabel}>{HYROX_STATION_LABEL[key]}</Text>
          <Text style={styles.contextValue}>{formatWeightKg(hyrox.stationWeights[key], units)}</Text>
        </View>
      ))}
      <View style={styles.contextRow}>
        <Text style={styles.contextLabel}>Sodium</Text>
        <Text style={styles.contextValue}>{intRange(hyrox.sodiumMgPerHour, 'mg/hr')}</Text>
      </View>
      <View style={styles.contextRow}>
        <Text style={styles.contextLabel}>Caffeine</Text>
        <Text style={styles.contextValue}>{intRange(hyrox.caffeineMg, 'mg')}</Text>
      </View>
    </Card>
  );
}

const CROSSFIT_LIFTS: { key: 'backSquat' | 'deadlift' | 'press'; label: string }[] = [
  { key: 'backSquat', label: 'Back squat' },
  { key: 'deadlift', label: 'Deadlift' },
  { key: 'press', label: 'Press' },
];

const CROSSFIT_TIER_LABEL: Record<BenchmarkTier, string> = {
  beginner: 'Beginner',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
  elite: 'Elite',
};

function CrossfitSection({ crossfit, units }: { crossfit: CrossfitPrescription | null; units: UnitSystem }) {
  if (!crossfit) {
    return (
      <Card style={styles.cardGap}>
        <Text style={styles.sectionLabel}>CROSSFIT</Text>
        <Text style={styles.hint}>Not set — enter your CrossFit numbers in Preferences to see your working loads and benchmark tier.</Text>
      </Card>
    );
  }
  return (
    <Card style={styles.cardGap}>
      <Text style={styles.sectionLabel}>CROSSFIT</Text>
      <Text style={styles.hint}>{crossfit.zoneName} · {crossfit.workingPercent1RM}% 1RM</Text>
      {CROSSFIT_LIFTS.map(({ key, label }) => (
        <View key={key} style={styles.contextRow}>
          <Text style={styles.contextLabel}>{label}</Text>
          <Text style={styles.contextValue}>
            {crossfit.strengthLoadsKg[key] > 0 ? formatWeightKg(crossfit.strengthLoadsKg[key], units) : 'Not set'}
          </Text>
        </View>
      ))}
      <Text style={styles.subLabel}>ENERGY SYSTEMS</Text>
      {crossfit.energySystems.map((z) => (
        <View key={z.system} style={styles.energyRow}>
          <Text style={styles.contextLabel}>{z.system}</Text>
          <Text style={styles.hint}>{z.minDurationSec}–{z.maxDurationSec ?? '∞'}s · {z.workToRest} · {z.purpose}</Text>
        </View>
      ))}
      <View style={styles.contextRow}>
        <Text style={styles.contextLabel}>Benchmark</Text>
        <Text style={styles.contextValue}>{crossfit.benchmark.name}</Text>
      </View>
      {crossfit.benchmark.franTier ? (
        <View style={styles.contextRow}>
          <Text style={styles.contextLabel}>Fran tier</Text>
          <Text style={styles.contextValue}>{CROSSFIT_TIER_LABEL[crossfit.benchmark.franTier]}</Text>
        </View>
      ) : (
        <Text style={styles.hint}>Not set — enter your Fran time in Preferences to see your benchmark tier.</Text>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Theme.ink },
  scroll: { padding: 16, gap: 16 },
  cardGap: { gap: 10 },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: Theme.accent,
    letterSpacing: 1,
    fontFamily: 'SpaceGrotesk_700Bold',
  },
  contextRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  contextLabel: { fontSize: 13, fontWeight: '600', color: Theme.textSoft, flex: 1 },
  contextValue: { fontSize: 14, fontWeight: '800', color: Theme.text },
  subLabel: { fontSize: 11, fontWeight: '700', color: Theme.textMut, letterSpacing: 1, marginTop: 6 },
  hint: { fontSize: 12, color: Theme.textMut, lineHeight: 16 },
  attemptBlock: { gap: 2 },
  energyRow: { gap: 2 },
});
