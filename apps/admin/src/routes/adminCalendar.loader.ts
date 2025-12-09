// src/routes/adminCalendar.loader.ts
import type { LoaderFunction } from "react-router-dom";
import { queryClient } from "@/lib/queryClient";
import { fetchCalendarWindowByMonth } from "@/services/calendar-window.service";
import { QK } from "@/queryKeys";
import { startOfMonth, parseISO, addMonths } from "date-fns";

export const adminCalendarLoader: LoaderFunction = async ({ request }) => {
  const url = new URL(request.url);
  const monthParam = url.searchParams.get("month");

  // базовый месяц: либо из query, либо текущий
  const baseMonth = monthParam
    ? startOfMonth(parseISO(monthParam))
    : startOfMonth(new Date());

  const monthISO = baseMonth.toISOString();

  // основное окно (месяц ±1)
  await queryClient.ensureQueryData({
    queryKey: QK.calendarWindow(monthISO),
    queryFn: () => fetchCalendarWindowByMonth(monthISO),
    staleTime: 60_000,
  });

  // опционально: заранее прогреем соседние месяцы для плавной навигации Prev/Next
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

  return { monthISO };
};
