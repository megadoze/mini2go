// src/services/calendar-window.service.ts
import { supabase } from "@/lib/supabase";
import { startOfMonth, addMonths, endOfMonth } from "date-fns";

export type CarLite = {
  id: string;
  brand: string | null;
  model: string | null;
  license_plate: string | null;
};
export type Booking = import("@/types/booking").Booking;
export type CarWithBookings = CarLite & { bookings: Booking[] };

export type CalendarWindow = {
  monthISO: string;
  rangeStart: string;
  rangeEnd: string;
  cars: CarWithBookings[];
};

// ⚠️ новая функция: окно календаря ТОЛЬКО для одного ownerId
export async function fetchCalendarWindowByMonthForOwner(
  ownerId: string,
  monthISO: string
): Promise<CalendarWindow> {
  const monthStart = startOfMonth(new Date(monthISO));
  const from = startOfMonth(addMonths(monthStart, -1)).toISOString();
  const to = endOfMonth(addMonths(monthStart, 1)).toISOString();

  const { data, error } = await supabase.rpc("cars_with_bookings_for_owner", {
    _owner_id: ownerId,
    _from: from,
    _to: to,
  });

  if (error) throw error;

  return {
    monthISO: monthStart.toISOString(),
    rangeStart: from,
    rangeEnd: to,
    cars: data ?? [],
  };
}

export async function fetchCalendarWindowByMonth(
  monthISO: string
): Promise<CalendarWindow> {
  const monthStart = startOfMonth(new Date(monthISO));
  const from = startOfMonth(addMonths(monthStart, -1)).toISOString();
  const to = endOfMonth(addMonths(monthStart, 1)).toISOString();

  // типизируем RPC результат
  const { data, error } = await supabase.rpc("cars_with_bookings", {
    _from: from,
    _to: to,
  });
  if (error) throw error;

  return {
    monthISO: monthStart.toISOString(),
    rangeStart: from,
    rangeEnd: to,
    cars: data ?? [],
  };
}
