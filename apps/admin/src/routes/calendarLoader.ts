// src/routes/calendar.loader.ts
import type { LoaderFunction } from "react-router-dom";
import { queryClient } from "@/lib/queryClient";
import { fetchCalendarWindowByMonthForOwner } from "@/services/calendar-window.service";
import { QK } from "@/queryKeys";
import { startOfMonth, parseISO, addMonths } from "date-fns";
import { supabase } from "@/lib/supabase";

export const calendarLoader: LoaderFunction = async ({ request }) => {
  const url = new URL(request.url);
  const monthParam = url.searchParams.get("month");

  const ownerId =
    url.searchParams.get("owner") ??
    (await supabase.auth.getSession()).data.session?.user?.id ??
    null;

  if (!ownerId) {
    throw new Response("Unauthorized", { status: 401 });
  }

  const baseMonth = monthParam
    ? startOfMonth(parseISO(monthParam))
    : startOfMonth(new Date());

  const monthISO = baseMonth.toISOString();

  // прогреем соседние месяцы
  const prevISO = startOfMonth(addMonths(baseMonth, -1)).toISOString();
  const nextISO = startOfMonth(addMonths(baseMonth, 1)).toISOString();

  // основное окно для owner-а
  await queryClient.ensureQueryData({
    queryKey: QK.calendarWindow(ownerId, monthISO),
    queryFn: () => fetchCalendarWindowByMonthForOwner(ownerId, monthISO),
    staleTime: 60_000,
  });

  // прогрев соседних
  void queryClient.prefetchQuery({
    queryKey: QK.calendarWindow(ownerId, prevISO),
    queryFn: () => fetchCalendarWindowByMonthForOwner(ownerId, prevISO),
    staleTime: 60_000,
  });

  void queryClient.prefetchQuery({
    queryKey: QK.calendarWindow(ownerId, nextISO),
    queryFn: () => fetchCalendarWindowByMonthForOwner(ownerId, nextISO),
    staleTime: 60_000,
  });

  return { monthISO, ownerId };
};
