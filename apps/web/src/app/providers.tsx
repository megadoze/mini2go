"use client";

import { ReactNode, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MantineProvider, ColorSchemeScript } from "@mantine/core";
import "@mantine/core/styles.css";

export function AppProviders({ children }: { children: ReactNode }) {
  // создаём QueryClient только на клиенте
  const [queryClient] = useState(() => new QueryClient());

  return (
    <>
      {/* Mantine требует ColorSchemeScript именно на клиенте, раз мы его тут юзаем */}
      <ColorSchemeScript />
      <QueryClientProvider client={queryClient}>
        <MantineProvider>{children}</MantineProvider>
      </QueryClientProvider>
    </>
  );
}
