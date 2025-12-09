// src/routes/dashboard.loader.ts
import type { LoaderFunction } from "react-router";
import { queryClient } from "@/lib/queryClient";
import { supabase } from "@/lib/supabase";
import { fetchCarsByHost } from "@/services/car.service";
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

export const dashboardLoader: LoaderFunction = async ({ request }) => {
  const url = new URL(request.url);

  const ownerId =
    url.searchParams.get("owner") ??
    (await supabase.auth.getSession()).data.session?.user?.id ??
    null;

  if (!ownerId) {
    throw new Response("Unauthorized", { status: 401 });
  }

  const now = new Date();

  // 🔥 ДЕЛАЕМ ТАК ЖЕ, КАК В КОМПОНЕНТЕ: ВЕСЬ ТЕКУЩИЙ МЕСЯЦ
  const defaultFromISO = startOfDay(startOfMonth(now)).toISOString();
  const defaultToISO = endOfDay(endOfMonth(now)).toISOString();

  const fromISO = url.searchParams.get("from") ?? defaultFromISO;
  const toISO = url.searchParams.get("to") ?? defaultToISO;

  const carsKey = ["carsByHost", ownerId] as const;
  const rangeKey = [
    "dashboardBookings",
    ownerId,
    "range",
    fromISO,
    toISO,
  ] as const;
  const last6mKey = ["dashboardBookings", ownerId, "last6m"] as const;
  const nowKey = ["dashboardBookings", ownerId, "now"] as const;

  // console.log("[hostDashboardLoader] start", { fromISO, toISO });

  // 3) ensure: машины
  const cars = await queryClient.ensureQueryData({
    queryKey: carsKey,
    queryFn: () => fetchCarsByHost(ownerId),
    staleTime: 5 * 60_000,
  });
  const carIds: string[] = (cars ?? []).map((c: any) => c.id);

  // 4) ensure: брони в диапазоне (ТОТ ЖЕ RANGE, ЧТО И В КОМПОНЕНТЕ)
  await queryClient.ensureQueryData({
    queryKey: rangeKey,
    queryFn: () => fetchBookingsIntersectingRange(carIds, fromISO, toISO),
    staleTime: 60_000,
  });

  // 5) ensure: последние 6 месяцев (для графика)
  const since6mISO = startOfMonth(subMonths(now, 5)).toISOString();
  await queryClient.ensureQueryData({
    queryKey: last6mKey,
    queryFn: () => fetchBookingsSince(carIds, since6mISO),
    staleTime: 60_000,
  });

  // 6) optionally: ensure "now" (чтобы KPI Active now тоже сразу был из кэша)
  const nowISO = new Date().toISOString();
  await queryClient.ensureQueryData({
    queryKey: nowKey,
    queryFn: () => fetchBookingsIntersectingRange(carIds, nowISO, nowISO),
    staleTime: 60_000,
  });

  // console.log("[hostDashboardLoader] done");
  return { ownerId, fromISO, toISO };
};
