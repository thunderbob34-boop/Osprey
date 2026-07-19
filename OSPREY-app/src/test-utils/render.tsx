import React, { type ReactElement, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render as rtlRender, type RenderOptions } from '@testing-library/react-native';

/**
 * Shared render helper for SCREEN tests.
 *
 * Screens reach react-query through nested cards and hooks (NutritionCard,
 * HydrationCard, useSubscription…), so rendering one bare throws on a missing
 * QueryClientProvider — an error about infrastructure, not about the thing
 * under test. This wraps every render in a fresh client.
 *
 * Retries are off and logging is silenced: a test asserting an error state
 * should fail fast and quietly rather than retrying three times and printing
 * a stack for an error it deliberately caused.
 */
export function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, staleTime: 0 },
      mutations: { retry: false },
    },
  });
}

export function renderWithProviders(
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'> & { queryClient?: QueryClient },
) {
  const queryClient = options?.queryClient ?? createTestQueryClient();

  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  }

  return {
    queryClient,
    ...rtlRender(ui, { wrapper: Wrapper, ...options }),
  };
}

export * from '@testing-library/react-native';
