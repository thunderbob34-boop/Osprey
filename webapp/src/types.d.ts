// Type stubs for OSPREY-app dependencies used by parity tests
declare module '@/services/supabase' {
  export const supabase: any;
}

declare module '@/types/preferences' {
  export type TriathlonDistance = 'sprint' | 'olympic' | 'half' | 'full';
}

declare module '@/constants/theme' {
  export type ReadinessTone = string;
}

declare module '@/types/daily-summary' {
  export interface TrainingReadiness {
    tsb: number;
    ctl: number;
    label: string;
    tone: string;
  }
}
