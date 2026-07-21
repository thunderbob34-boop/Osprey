import { vi } from 'vitest';

// Mock the OSPREY-app's supabase client so we can import pure functions
// from performance.ts without runtime dependency errors.
vi.mock('@/services/supabase', () => ({
  supabase: {},
}));

vi.mock('@/types/preferences', () => ({}));
vi.mock('@/constants/theme', () => ({}));
vi.mock('@/types/daily-summary', () => ({}));
