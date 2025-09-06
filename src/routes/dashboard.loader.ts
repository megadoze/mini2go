import type { LoaderFunction } from "react-router";
import { queryClient } from "@/lib/queryClient";
import { fetchCarsByHost } from "@/services/car.service";
import { startOfDay, endOfDay, startOfMonth, subMonths } from "date-fns";
import {
  fetchBookingsIntersectingRange,
  fetchBookingsSince,
} from "@/services/booking-lite.service";

export const dashboardLoader: LoaderFunction = async ({ request }) => {
  const url = new URL(request.url);

  // владелец (как в bookings.loader)
  const ownerId =
    url.searchParams.get("owner") || "a96e557e-5298-4018-bcd9-1f4e5423c2a0";

  // период (по умолчанию: с 1 числа текущего месяца по сегодня)
  const fromISO =
    url.searchParams.get("from") ??
    startOfDay(startOfMonth(new Date())).toISOString();
  const toISO =
    url.searchParams.get("to") ?? endOfDay(new Date()).toISOString();

  const carsKey = ["carsByHost", ownerId] as const;
  const rangeKey = [
    "dashboardBookings",
    ownerId,
    "range",
    fromISO,
    toISO,
  ] as const;
  const last6mKey = ["dashboardBookings", ownerId, "last6m"] as const;

  // 1) Машины владельца
  const cars = await queryClient.ensureQueryData({
    queryKey: carsKey,
    queryFn: () => fetchCarsByHost(ownerId),
    staleTime: 5 * 60_000,
  });

  const carIds: string[] = (cars ?? []).map((c: any) => c.id);

  // 2) Бронирования, пересекающие период
  await queryClient.ensureQueryData({
    queryKey: rangeKey,
    queryFn: () => fetchBookingsIntersectingRange(carIds, fromISO, toISO),
    staleTime: 60_000,
  });

  // 3) Бронирования за последние 6 месяцев (для трендов)
  const since6mISO = startOfMonth(subMonths(new Date(), 5)).toISOString();
  await queryClient.ensureQueryData({
    queryKey: last6mKey,
    queryFn: () => fetchBookingsSince(carIds, since6mISO),
    staleTime: 60_000,
  });

  return { ownerId, fromISO, toISO };
};
