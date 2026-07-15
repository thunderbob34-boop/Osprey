import { z } from 'zod';

const SourceEnum = z.enum(['self_report', 'derived', 'estimate']);

export const ThresholdAnchorSchema = z
  .object({
    run: z.object({ thresholdSecPerMile: z.number(), source: SourceEnum }),
    swim: z.object({ cssSecPer100: z.number(), source: SourceEnum }),
    row: z.object({ splitSecPer500: z.number(), source: SourceEnum }),
  })
  .partial();

export type ThresholdAnchorMap = z.infer<typeof ThresholdAnchorSchema>;
export type AnchorKey = 'run' | 'swim' | 'row';

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
