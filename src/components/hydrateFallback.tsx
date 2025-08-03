// src/components/HydrateFallback.tsx
import { Loader } from "@mantine/core";

export default function HydrateFallback() {
  return (
    <div style={{ padding: 16 }}>
      <Loader size="sm" />
    </div>
  );
}
