// src/routes/carsAdminLoader.ts
import type { LoaderFunction } from "react-router";
import { queryClient } from "@/lib/queryClient";
import { fetchCountries } from "@/services/geo.service";
import { fetchCarsPage } from "@/services/car.service";
import type { InfiniteData } from "@tanstack/react-query";
import type { CarWithRelations } from "@/types/carWithRelations";

export const ADMIN_CARS_PAGE_SIZE = 10;

type Page = { items: CarWithRelations[]; count: number };

export const ADMIN_CARS_QUERY_KEY = [
  "adminCars",
  ADMIN_CARS_PAGE_SIZE,
] as const;

export const carsAdminLoader: LoaderFunction = async () => {
  // 🌍 страны — справочник
  await queryClient.ensureQueryData({
    queryKey: ["countries"],
    queryFn: fetchCountries,
    staleTime: 24 * 60 * 60 * 1000,
  });

  // 🚗 первая страница машин для админа в форме InfiniteData
  await queryClient.ensureQueryData<InfiniteData<Page, number>>({
    queryKey: ADMIN_CARS_QUERY_KEY,
    queryFn: async () => {
      const firstPage = await fetchCarsPage({
        limit: ADMIN_CARS_PAGE_SIZE,
        offset: 0,
      });

      return {
        pages: [firstPage],
        pageParams: [0],
      };
    },
    staleTime: 5 * 60_000,
  });

  // дефолты для этого ключа (совпадают с компонентом)
  queryClient.setQueryDefaults(ADMIN_CARS_QUERY_KEY, {
    staleTime: 5 * 60_000,
    gcTime: 7 * 24 * 60 * 60 * 1000,
  });

  return null;
};
