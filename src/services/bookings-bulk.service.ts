// services/bookings-bulk.service.ts
import type { Booking } from "@/types/booking";
import { supabase } from "@/lib/supabase";

export async function fetchBookingsBulk(
  carIds: string[],
  startISO: string,
  endISO: string
): Promise<Record<string, Booking[]>> {
  const { data, error } = await supabase.rpc("bookings_for_cars", {
    _car_ids: carIds,
    _from: startISO,
    _to: endISO,
  });
  if (error) throw error;

  const byCar: Record<string, Booking[]> = {};
  for (const row of (data ?? []) as Booking[]) {
    (byCar[row.car_id!] ||= []).push(row);
  }
  return byCar;
}
