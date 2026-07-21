import { formatMinSec, type Range } from '@/services/calculators/types';
import type { UnitSystem } from '@/services/units';

// Canonical mile↔km ratio (matches useDisplayZones.ts / services/units.ts).
export const MILES_PER_KM = 0.621371;
// 100 yd = 91.44 m — swim pace/100yd is *faster* (fewer seconds) than /100m
// because the pool distance is shorter, so this factor is < 1.
export const YD_PER_100M = 0.9144;

/**
 * sec/mile (a pace — inverse of distance) → "M:SS/mi", or "M:SS/km" when metric.
 * Converting a *pace* from mile-denominated to km-denominated multiplies by
 * MILES_PER_KM (mirrors kmToMiles's direction, not milesToKm's) — a pace gets
 * FASTER (fewer seconds) per the shorter unit. Sanity check against a real
 * anchor.ts tier value: 450 sec/mi ("intermediate", 7:30/mi) is a 12.875 km/h
 * pace, i.e. 4:40/km — 450 * 0.621371 = 279.6s = 4:40. (450 / 0.621371 would
 * give a nonsensical 12:04/km — more than 2.5× too slow — so this helper
 * multiplies, it does not divide.)
 */
export function paceMi(sec: number, units: UnitSystem): string {
  const value = units === 'metric' ? sec * MILES_PER_KM : sec;
  return `${formatMinSec(value)}/${units === 'metric' ? 'km' : 'mi'}`;
}

export function paceRangeMi(range: Range, units: UnitSystem): string {
  if (range.min == null || range.max == null) return '—';
  const factor = units === 'metric' ? MILES_PER_KM : 1;
  const suffix = units === 'metric' ? '/km' : '/mi';
  return `${formatMinSec(range.min * factor)}–${formatMinSec(range.max * factor)}${suffix}`;
}

/** sec/100m → "M:SS/100m" (metric) or "M:SS/100yd" (imperial, scaled by YD_PER_100M). */
export function swim100(sec: number, units: UnitSystem): string {
  const value = units === 'metric' ? sec : sec * YD_PER_100M;
  return `${formatMinSec(value)}/100${units === 'metric' ? 'm' : 'yd'}`;
}

export function swim100Range(range: Range, units: UnitSystem): string {
  if (range.min == null || range.max == null) return '—';
  const factor = units === 'metric' ? 1 : YD_PER_100M;
  const suffix = units === 'metric' ? '/100m' : '/100yd';
  return `${formatMinSec(range.min * factor)}–${formatMinSec(range.max * factor)}${suffix}`;
}

/** sec/500m — rowing splits are unit-agnostic (Concept2 ergs always read meters). */
export function rowing500Range(range: Range): string {
  if (range.min == null || range.max == null) return '—';
  return `${formatMinSec(range.min)}–${formatMinSec(range.max)}/500m`;
}

/** Integer ranges for watts / bpm — neither needs a unit conversion. */
export function intRange(range: Range, unit: string): string {
  if (range.min == null || range.max == null) return '—';
  return `${Math.round(range.min)}–${Math.round(range.max)} ${unit}`;
}
