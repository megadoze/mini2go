// src/routes/carsLoader.ts
import { queryClient } from "@/lib/queryClient";
import { fetchCars } from "@/services/car.service";
import { fetchCountries } from "@/services/geo.service";

export async function carsLoader() {
  await Promise.all([
    queryClient.ensureQueryData({
      queryKey: ["cars"],
      queryFn: () => fetchCars(),
      staleTime: 24 * 60 * 60 * 1000, // 1 день
    }),
    queryClient.ensureQueryData({
      queryKey: ["countries"],
      queryFn: () => fetchCountries(),
   staleTime: 24 * 60 * 60 * 1000, // 1 день
    }),
  ]);

  return null; // компонент возьмёт всё из кэша
}
