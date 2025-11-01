import { supabase } from "@/lib/supabase";
import type { BookingFull } from "@/app/car/calendar/calendar.service";


// диапазон пересекается, если (start_at <= end) и (end_at >= start)
export async function fetchBookingsForCarsInRange(params: {
  carIds: string[];
  start: string; // ISO
  end: string;   // ISO
}): Promise<BookingFull[]> {
  const { carIds, start, end } = params;
  if (!carIds.length) return [];

  // supabase не любит очень большие in(), но под каталожные 50 — норм
  const { data, error } = await supabase
    .from("v_bookings_full")
    .select("*")
    .in("car_id", carIds)
    // внимание: тут две части пересечения
    .lte("start_at", end)
    .gte("end_at", start);

  if (error) throw error;
  return (data ?? []) as BookingFull[];
}
