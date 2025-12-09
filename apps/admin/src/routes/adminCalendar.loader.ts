// src/routes/adminCalendar.loader.ts
import type { LoaderFunction } from "react-router-dom";
import { queryClient } from "@/lib/queryClient";
import { fetchCalendarWindowByMonth } from "@/services/calendar-window.service";
import { QK } from "@/queryKeys";
import { startOfMonth, parseISO, addMonths } from "date-fns";

export const adminCalendarLoader: LoaderFunction = async ({ request }) => {
  const url = new URL(request.url);
  const monthParam = url.searchParams.get("month");

  const baseMonth = monthParam
    ? startOfMonth(parseISO(monthParam))
    : startOfMonth(new Date());

  const monthISO = baseMonth.toISOString();

  const window = await queryClient.ensureQueryData({
    queryKey: QK.calendarWindow(monthISO),
    queryFn: () => fetchCalendarWindowByMonth(monthISO),
    staleTime: 60_000,
  });

  // префетч соседей — как было
  const prevISO = startOfMonth(addMonths(baseMonth, -1)).toISOString();
  const nextISO = startOfMonth(addMonths(baseMonth, 1)).toISOString();

  void queryClient.prefetchQuery({
    queryKey: QK.calendarWindow(prevISO),
    queryFn: () => fetchCalendarWindowByMonth(prevISO),
    staleTime: 60_000,
  });

  void queryClient.prefetchQuery({
    queryKey: QK.calendarWindow(nextISO),
    queryFn: () => fetchCalendarWindowByMonth(nextISO),
    staleTime: 60_000,
  });

  return { monthISO, window };
};
