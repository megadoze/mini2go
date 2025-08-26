import { supabase } from "@/lib/supabase";
import { startOfMonth, addMonths, endOfMonth } from "date-fns";

// ВАЖНО: loader дергается при заходе/навигации на /calendar
export async function calendarLoader({ request }: { request: Request }) {
  const url = new URL(request.url);
  const monthISO =
    url.searchParams.get("month") ?? startOfMonth(new Date()).toISOString();
  const month = startOfMonth(new Date(monthISO));
  const rangeStart = startOfMonth(addMonths(month, -1));
  const rangeEnd = endOfMonth(addMonths(month, 1));

  const { data, error } = await supabase.rpc("cars_with_bookings", {
    _from: rangeStart.toISOString(),
    _to: rangeEnd.toISOString(),
  });
  if (error) throw error;

  // data: { id, name, bookings: Booking[] }[]
  return {
    monthISO: month.toISOString(),
    rangeStart: rangeStart.toISOString(),
    rangeEnd: rangeEnd.toISOString(),
    cars: data,
  };
}
