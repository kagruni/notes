import { QueryClient } from '@tanstack/react-query';

/**
 * React Query Client Configuration
 *
 * Optimized for Firebase with:
 * - Longer stale times to reduce Firebase reads
 * - Smart caching strategies
 * - Error handling
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Data is considered fresh for 5 minutes (reduce Firebase reads)
      staleTime: 5 * 60 * 1000,

      // Cache data for 10 minutes even if unused
      gcTime: 10 * 60 * 1000,

      // Retry failed requests
      retry: 1,

      // Don't refetch on window focus by default (Firebase real-time handles this)
      refetchOnWindowFocus: false,

      // Don't refetch on mount if data is fresh
      refetchOnMount: false,

      // Refetch on reconnect to ensure data is up to date
      refetchOnReconnect: true,
    },
    mutations: {
      // Retry mutations once on failure
      retry: 1,
    },
  },
});
