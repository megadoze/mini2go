// src/routes/carsLoader.ts
import { queryClient } from "@/lib/queryClient";
import { fetchCountries } from "@/services/geo.service";

export async function carsLoader() {
  await queryClient.ensureQueryData({
    queryKey: ["countries"],
    queryFn: () => fetchCountries(),
    staleTime: 24 * 60 * 60 * 1000,
  });
  return null;
}
