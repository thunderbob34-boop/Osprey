import { z } from 'zod';

const SourceEnum = z.enum(['self_report', 'derived', 'estimate']);
// WS1: how much extrapolation a 'derived' anchor trusts (mobile's
// coaching/anchor-policy.ts). Optional — self-reported anchors don't carry one,
// and z.object() strips unknown keys rather than failing, so this can be added
// without breaking anchors written before this field existed.
const ConfidenceEnum = z.enum(['low', 'moderate', 'high']);

export const ThresholdAnchorSchema = z
  .object({
    run: z.object({ thresholdSecPerMile: z.number(), source: SourceEnum, confidence: ConfidenceEnum.optional() }),
    swim: z.object({ cssSecPer100: z.number(), source: SourceEnum, confidence: ConfidenceEnum.optional() }),
    row: z.object({ splitSecPer500: z.number(), source: SourceEnum, confidence: ConfidenceEnum.optional() }),
    bike: z.object({ ftpWatts: z.number(), source: SourceEnum, confidence: ConfidenceEnum.optional() }),
  })
  .partial();

export type ThresholdAnchorMap = z.infer<typeof ThresholdAnchorSchema>;
export type AnchorKey = 'run' | 'swim' | 'row' | 'bike';

// Robust read: a malformed/partial JSONB column becomes {} rather than throwing
// or passing a bad number downstream. Hardens the read the mobile app does with
// an unchecked cast.
export function parseThresholdAnchor(raw: unknown): ThresholdAnchorMap {
  const res = ThresholdAnchorSchema.safeParse(raw);
  return res.success ? res.data : {};
}

// Non-generic + internal cast: a dynamic (union) key with a union value can't be
// expressed as type-safe at the computed-property level, but the caller passes the
// entry shape matching `key`, so the runtime is correct.
export function setAnchorEntry(
  map: ThresholdAnchorMap,
  key: AnchorKey,
  value: NonNullable<ThresholdAnchorMap[AnchorKey]>,
): ThresholdAnchorMap {
  return { ...map, [key]: value } as ThresholdAnchorMap;
}

export function clearAnchorEntry(map: ThresholdAnchorMap, key: AnchorKey): ThresholdAnchorMap {
  const next = { ...map };
  delete next[key];
  return next;
}
