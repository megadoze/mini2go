// src/routes/carsLoader.ts
import type { LoaderFunction } from "react-router";
import { queryClient } from "@/lib/queryClient";
import { fetchCountries } from "@/services/geo.service";
import { fetchCarsPage } from "@/services/car.service";
import type { InfiniteData } from "@tanstack/react-query";
import type { CarWithRelations } from "@/types/carWithRelations";

const PAGE_SIZE = 10;
type Page = { items: CarWithRelations[]; count: number };

export const carsAdminLoader: LoaderFunction = async ({}) => {
  // const url = new URL(request.url);

  // справочники
  await queryClient.ensureQueryData({
    queryKey: ["countries"],
    queryFn: fetchCountries,
    staleTime: 24 * 60 * 60 * 1000,
  });

  const key = ["adminCars", PAGE_SIZE] as const;

  // ✅ прогреваем тем же ключом и в формате InfiniteData
  await queryClient.ensureQueryData<InfiniteData<Page, number>>({
    queryKey: key,
    queryFn: async () => {
      const firstPage = await fetchCarsPage({
        limit: PAGE_SIZE,
        offset: 0,
      });
      return { pages: [firstPage], pageParams: [0] };
    },
    staleTime: 5 * 60_000,
  });

  // (необязательно, но приятно) — дефолты для этого ключа
  queryClient.setQueryDefaults(key, {
    staleTime: 5 * 60_000,
    gcTime: 7 * 24 * 60 * 60 * 1000,
  });

  // return { ownerId };
};
