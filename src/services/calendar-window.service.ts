// src/services/calendar-window.service.ts
import { supabase } from "@/lib/supabase";
import { startOfMonth, addMonths, endOfMonth } from "date-fns";

export type CarLite = { id: string; name: string };
export type Booking = import("@/types/booking").Booking;
export type CarWithBookings = CarLite & { bookings: Booking[] };

export async function fetchCalendarWindowByMonth(monthISO: string) {
  const monthStart = startOfMonth(new Date(monthISO));
  const from = startOfMonth(addMonths(monthStart, -1)).toISOString();
  const to = endOfMonth(addMonths(monthStart, 1)).toISOString();

  const { data, error } = await supabase.rpc("cars_with_bookings", {
    _from: from,
    _to: to,
  });
  if (error) throw error;

  return {
    monthISO: monthStart.toISOString(),
    rangeStart: from,
    rangeEnd: to,
    cars: (data ?? []) as CarWithBookings[],
  };
}
