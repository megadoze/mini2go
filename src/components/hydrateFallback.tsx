import { Loader } from "@mantine/core";

export default function HydrateFallback() {
  return (
    <div style={{ padding: 16 }}>
      <Loader color="dark" size="xs" />
    </div>
  );
}
