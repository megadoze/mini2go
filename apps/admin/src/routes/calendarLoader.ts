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

  const baseMonth = monthParam
    ? startOfMonth(parseISO(monthParam))
    : startOfMonth(new Date());

  const monthISO = baseMonth.toISOString();

  // берём текущего юзера у клиента (SPA-лоадер, можно использовать supabase-js)
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const meId = user?.id ?? null;

  // если юзера нет — просто вернём monthISO, компонент сам покажет "Sign in..."
  if (!meId) {
    return { monthISO, meId: null };
  }

  // основное окно для owner-а
  await queryClient.ensureQueryData({
    queryKey: QK.calendarWindow(`${monthISO}-${meId}`),
    queryFn: () => fetchCalendarWindowByMonthForOwner(meId, monthISO),
    staleTime: 60_000,
  });

  // прогреем соседние месяцы
  const prevISO = startOfMonth(addMonths(baseMonth, -1)).toISOString();
  const nextISO = startOfMonth(addMonths(baseMonth, 1)).toISOString();

  void queryClient.prefetchQuery({
    queryKey: QK.calendarWindow(`${prevISO}-${meId}`),
    queryFn: () => fetchCalendarWindowByMonthForOwner(meId, prevISO),
    staleTime: 60_000,
  });

  void queryClient.prefetchQuery({
    queryKey: QK.calendarWindow(`${nextISO}-${meId}`),
    queryFn: () => fetchCalendarWindowByMonthForOwner(meId, nextISO),
    staleTime: 60_000,
  });

  return { monthISO, meId };
};
