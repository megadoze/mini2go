// src/components/ClientOnly.tsx
"use client";

import { useEffect, useState, type PropsWithChildren } from "react";

export default function ClientOnly({ children }: PropsWithChildren) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  if (!mounted) return null;
  return <>{children}</>;
}
