import type { IntervalEffort, IntervalPrescription } from '@/types/workout';

export interface IntervalStep {
  phase: 'work' | 'rest';
  segmentIndex: number;
  repIndex: number;
  totalReps: number;
  label: string;
  /** Countdown target in seconds — null means distance-based (user marks it complete manually). */
  durationS: number | null;
  distanceM: number | null;
  effort: IntervalEffort | 'rest';
}

/** Flattens segment/rep-count prescriptions into a linear list of work/rest steps. */
export function expandIntervalSteps(prescription: IntervalPrescription): IntervalStep[] {
  const steps: IntervalStep[] = [];
  const segments = prescription.segments;

  segments.forEach((segment, segmentIndex) => {
    for (let rep = 1; rep <= segment.reps; rep++) {
      steps.push({
        phase: 'work',
        segmentIndex,
        repIndex: rep,
        totalReps: segment.reps,
        label: segment.label,
        durationS: segment.durationS,
        distanceM: segment.distanceM,
        effort: segment.effort,
      });

      const isLastRepOfLastSegment = segmentIndex === segments.length - 1 && rep === segment.reps;
      if (segment.restS > 0 && !isLastRepOfLastSegment) {
        steps.push({
          phase: 'rest',
          segmentIndex,
          repIndex: rep,
          totalReps: segment.reps,
          label: 'Rest',
          durationS: segment.restS,
          distanceM: null,
          effort: 'rest',
        });
      }
    }
  });

  return steps;
}

/** Total prescribed distance across all segments, or null if any segment is duration-based. */
export function totalIntervalDistanceM(prescription: IntervalPrescription): number | null {
  let total = 0;
  for (const segment of prescription.segments) {
    if (segment.distanceM == null) return null;
    total += segment.distanceM * segment.reps;
  }
  return total;
}

export function ozzieCueForStep(step: IntervalStep): string {
  if (step.phase === 'rest') {
    return `Rest — ${step.durationS}s.`;
  }
  const position = step.totalReps > 1 ? `Rep ${step.repIndex} of ${step.totalReps}. ` : '';
  return `${position}${step.label}.`;
}
