export interface SavedRoute {
  id: string;
  name: string;
  tags: string[];
  distanceMiles: number | null;
  notes: string | null;
  createdAt: string;
}

export interface SavedRouteInput {
  name: string;
  tags: string[];
  distanceMiles?: number | null;
  notes?: string | null;
}

/** Curated tag chips shown when creating a route — freeform tags are also allowed. */
export const SUGGESTED_ROUTE_TAGS = [
  'shaded',
  'indoor',
  'covered',
  'trail',
  'flat',
  'hilly',
  'scenic',
  'loop',
  'track',
] as const;
