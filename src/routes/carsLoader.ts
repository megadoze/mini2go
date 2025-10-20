// src/routes/carsLoader.ts
import type { LoaderFunction } from "react-router";
import { queryClient } from "@/lib/queryClient";
import { supabase } from "@/lib/supabase";
import { fetchCountries } from "@/services/geo.service";
import { fetchCarsPageByHost } from "@/services/car.service";
import type { InfiniteData } from "@tanstack/react-query";
import type { CarWithRelations } from "@/types/carWithRelations";

const PAGE_SIZE = 10;
type Page = { items: CarWithRelations[]; count: number };

export const carsLoader: LoaderFunction = async ({ request }) => {
  const url = new URL(request.url);

  const { data: { session } } = await supabase.auth.getSession();
  const meId = session?.user?.id ?? null;
  const ownerId = (url.searchParams.get("owner") ?? meId) as string | null;

  // справочники
  await queryClient.ensureQueryData({
    queryKey: ["countries"],
    queryFn: fetchCountries,
    staleTime: 24 * 60 * 60 * 1000,
  });

  if (!ownerId) return { ownerId: null };

  const key = ["carsByHost", PAGE_SIZE, ownerId] as const;

  // ✅ прогреваем тем же ключом и в формате InfiniteData
  await queryClient.ensureQueryData<InfiniteData<Page, number>>({
    queryKey: key,
    queryFn: async () => {
      const firstPage = await fetchCarsPageByHost({
        ownerId,
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

  return { ownerId };
};

