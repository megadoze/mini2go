// src/lib/queryClient.ts
import { QK } from "@/queryKeys";
import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000, // базово 1 минута
      gcTime: 10 * 60_000, // держим в памяти 10 минут
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      refetchOnMount: false,
      retry: 1,
    },
  },
});

queryClient.setQueryDefaults(QK.extras, {
  staleTime: 10 * 60_000,
  refetchOnMount: false,
  refetchOnWindowFocus: false,
  refetchOnReconnect: false,
});

queryClient.setQueryDefaults(["appSettings"], {
  staleTime: 10 * 60_000,
  refetchOnMount: false,
  refetchOnWindowFocus: false,
  refetchOnReconnect: false,
});
