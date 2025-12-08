import { supabase } from "@/lib/supabase";

export type BookingRow = {
  id: string;
  start_at: string;
  end_at: string;
  mark: string | null;
  status: string | null;
  car_id: string;
  user_id: string | null;
  price_total: number | null;
  created_at: string | null;
};

// Пересечение интервала: start_at <= to AND end_at >= from
export async function fetchBookingsIntersectingRange(
  carIds: string[],
  fromISO: string,
  toISO: string
): Promise<BookingRow[]> {
  if (!carIds.length) return [];
  const { data, error } = await supabase
    .from("bookings")
    .select(
      "id, start_at, end_at, mark, status, car_id, user_id, price_total, delivery_lat, delivery_long, created_at"
    )
    .in("car_id", carIds)
    .lte("start_at", toISO)
    .gte("end_at", fromISO)
    .order("start_at", { ascending: true });

  if (error) throw error;
  return (data ?? []) as BookingRow[];
}

// Все бронирования с определённой даты (для трендов, напр. последние 6м)
export async function fetchBookingsSince(
  carIds: string[],
  sinceISO: string
): Promise<BookingRow[]> {
  if (!carIds.length) return [];
  const { data, error } = await supabase
    .from("bookings")
    .select(
      "id, start_at, end_at, mark, status, car_id, user_id, price_total, created_at"
    )
    .in("car_id", carIds)
    .gte("start_at", sinceISO)
    .order("start_at", { ascending: true });

  if (error) throw error;
  return (data ?? []) as BookingRow[];
}
