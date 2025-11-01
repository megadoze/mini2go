// src/routes/dashboard.loader.ts
import type { LoaderFunction } from "react-router";
import { queryClient } from "@/lib/queryClient";
import { supabase } from "@/lib/supabase";
import { fetchCarsByHost } from "@/services/car.service";
import { startOfDay, endOfDay, startOfMonth, subMonths } from "date-fns";
import {
  fetchBookingsIntersectingRange,
  fetchBookingsSince,
} from "@/services/booking-lite.service";

export const dashboardLoader: LoaderFunction = async ({ request }) => {
  const url = new URL(request.url);

  // 1) ownerId: приоритет — из сессии; для дебага можно пробросить ?owner=...
  const ownerId =
    url.searchParams.get("owner") ??
    (await supabase.auth.getSession()).data.session?.user?.id ??
    null;

  if (!ownerId) {
    // если нет сессии — можно редиректить на /auth или кинуть 401
    // здесь просто кинем
    throw new Response("Unauthorized", { status: 401 });
  }

  // 2) период
  const fromISO =
    url.searchParams.get("from") ??
    startOfDay(startOfMonth(new Date())).toISOString();
  const toISO =
    url.searchParams.get("to") ?? endOfDay(new Date()).toISOString();

  const carsKey = ["carsByHost", ownerId] as const;
  const rangeKey = ["dashboardBookings", ownerId, "range", fromISO, toISO] as const;
  const last6mKey = ["dashboardBookings", ownerId, "last6m"] as const;

  // 3) ensure: машины конкретного хоста
  const cars = await queryClient.ensureQueryData({
    queryKey: carsKey,
    queryFn: () => fetchCarsByHost(ownerId!),
    staleTime: 5 * 60_000,
  });
  const carIds: string[] = (cars ?? []).map((c: any) => c.id);

  // 4) ensure: брони в диапазоне
  await queryClient.ensureQueryData({
    queryKey: rangeKey,
    queryFn: () => fetchBookingsIntersectingRange(carIds, fromISO, toISO),
    staleTime: 60_000,
  });

  // 5) ensure: за последние 6 месяцев
  const since6mISO = startOfMonth(subMonths(new Date(), 5)).toISOString();
  await queryClient.ensureQueryData({
    queryKey: last6mKey,
    queryFn: () => fetchBookingsSince(carIds, since6mISO),
    staleTime: 60_000,
  });

  return { ownerId, fromISO, toISO };
};
