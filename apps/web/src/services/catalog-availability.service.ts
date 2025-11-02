// src/services/catalog-availability.service.ts
"use client";

import { getSupabaseClient } from "@/lib/supabase";
import type { BookingFull } from "./calendar.service";

// диапазон пересекается, если (start_at <= end) и (end_at >= start)
export async function fetchBookingsForCarsInRange(params: {
  carIds: string[];
  start: string; // ISO
  end: string; // ISO
}): Promise<BookingFull[]> {
  const { carIds, start, end } = params;
  if (!carIds.length) return [];

  const supabase = getSupabaseClient();
  // если это билд / нет env — просто не валим сборку
  if (!supabase) {
    if (process.env.NODE_ENV !== "production") {
      console.warn(
        "[catalog-availability.service] supabase client not available, returning []"
      );
    }
    return [];
  }

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
