// src/routes/calendarLoader.ts
import { queryClient } from "@/lib/queryClient";
import { QK } from "@/queryKeys";
import { fetchCalendarWindowByMonth } from "@/services/calendar-window.service";
import { startOfMonth } from "date-fns";

export async function calendarLoader({ request }: { request: Request }) {
  const url = new URL(request.url);
  const param = url.searchParams.get("month");

  const paramDate = param ? new Date(param) : null;
  const baseDate =
    paramDate && !Number.isNaN(+paramDate) ? paramDate : new Date();
  const monthISO = startOfMonth(baseDate).toISOString();

  await queryClient.ensureQueryData({
    queryKey: QK.calendarWindow(monthISO),
    queryFn: () => fetchCalendarWindowByMonth(monthISO),
    staleTime: 60_000,
  });

  return { monthISO };
}
