// src/routes/adminDashboard.loader.ts
import type { LoaderFunction } from "react-router";
import { queryClient } from "@/lib/queryClient";
import { supabase } from "@/lib/supabase";
import { fetchCarsForAdmin } from "@/services/car.service";
import {
  startOfDay,
  endOfDay,
  startOfMonth,
  endOfMonth,
  subMonths,
} from "date-fns";
import {
  fetchBookingsIntersectingRange,
  fetchBookingsSince,
} from "@/services/booking-lite.service";

export const adminDashboardLoader: LoaderFunction = async ({ request }) => {
  const url = new URL(request.url);

  const session = (await supabase.auth.getSession()).data.session;
  if (!session?.user?.id) {
    console.log("[adminDashboardLoader] NO SESSION → 401");
    throw new Response("Unauthorized", { status: 401 });
  }

  const now = new Date();
  const defaultFrom = startOfDay(startOfMonth(now));
  const defaultTo = endOfDay(endOfMonth(now));

  const fromISO = url.searchParams.get("from") ?? defaultFrom.toISOString();
  const toISO = url.searchParams.get("to") ?? defaultTo.toISOString();

  const carsKey = ["adminCars"] as const;
  const rangeKey = [
    "dashboardBookings",
    "admin",
    "range",
    fromISO,
    toISO,
  ] as const;
  const last6mKey = ["dashboardBookings", "admin", "last6m"] as const;
  const nowKey = ["dashboardBookings", "admin", "now"] as const;

  // 1) машины
  const cars = await queryClient.ensureQueryData({
    queryKey: carsKey,
    queryFn: () => fetchCarsForAdmin(),
    staleTime: 5 * 60_000,
  });
  const carIds: string[] = (cars ?? []).map((c: any) => c.id);

  if (carIds.length === 0) {
    console.log("[adminDashboardLoader] no cars, finish");
    return { fromISO, toISO };
  }

  // 2) диапазон
  await queryClient.ensureQueryData({
    queryKey: rangeKey,
    queryFn: () => fetchBookingsIntersectingRange(carIds, fromISO, toISO),
    staleTime: 60_000,
  });

  // 3) 6 месяцев
  const since6mISO = startOfDay(startOfMonth(subMonths(now, 5))).toISOString();
  await queryClient.ensureQueryData({
    queryKey: last6mKey,
    queryFn: () => fetchBookingsSince(carIds, since6mISO),
    staleTime: 60_000,
  });

  // 4) now
  const nowIso = new Date().toISOString();
  await queryClient.ensureQueryData({
    queryKey: nowKey,
    queryFn: () => fetchBookingsIntersectingRange(carIds, nowIso, nowIso),
    staleTime: 60_000,
  });

  return { fromISO, toISO };
};
