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

  // 1) ownerId из query или текущая сессия (как в бронях)
  const { data: { session } } = await supabase.auth.getSession();
  const meId = session?.user?.id ?? null;
  const ownerId = url.searchParams.get("owner") ?? meId;

  // 2) прогреем справочники
  await queryClient.ensureQueryData({
    queryKey: ["countries"],
    queryFn: fetchCountries,
    staleTime: 24 * 60 * 60 * 1000,
  });

  // 3) если гость — просто вернём null (компонент покажет Sign in…)
  if (!ownerId) return { ownerId: null };

  // 4) прогреем 1-ю страницу машин и положим её
  const firstPage = await fetchCarsPageByHost({
    ownerId,
    limit: PAGE_SIZE,
    offset: 0,
  });

  const key = ["carsByHost", PAGE_SIZE, ownerId] as const;
  const infiniteShape: InfiniteData<Page> = {
    pages: [firstPage],
    pageParams: [0],
  };
  queryClient.setQueryData<InfiniteData<Page>>(key, infiniteShape);

  return { ownerId };
};
