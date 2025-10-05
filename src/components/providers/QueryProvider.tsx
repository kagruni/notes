'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { useState } from 'react';

interface QueryProviderProps {
  children: React.ReactNode;
}

export function QueryProvider({ children }: QueryProviderProps) {
  // Create a new QueryClient instance per component tree
  // This prevents stale mutation references in Next.js App Router
  const [queryClient] = useState(
    () =>
      new QueryClient({
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
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {/* Only show DevTools in development */}
      {process.env.NODE_ENV === 'development' && (
        <ReactQueryDevtools initialIsOpen={false} />
      )}
    </QueryClientProvider>
  );
}
