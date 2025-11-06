// src/services/catalog-availability.service.ts
"use client";

import { getSupabaseClient } from "@/lib/supabase";
import type { BookingFull } from "./calendar.service";

export async function fetchBookingsForCarsInRange(params: {
  carIds: string[];
  start: string; // ISO
  end: string; // ISO
  bufferMinutes?: number; // optional buffer in minutes (default 0)
}): Promise<BookingFull[]> {
  const { carIds, start, end, bufferMinutes = 0 } = params;
  if (!carIds || !carIds.length) return [];

  const supabase = getSupabaseClient();
  if (!supabase) {
    if (process.env.NODE_ENV !== "production") {
      console.warn(
        "[catalog-availability.service] supabase client not available, returning []"
      );
    }
    return [];
  }

  // compute adjusted interval with buffer (ISO strings)
  const startMs = new Date(start).getTime();
  const endMs = new Date(end).getTime();
  const bufMs = Math.max(0, Number(bufferMinutes) || 0) * 60 * 1000;
  const adjStart = new Date(startMs - bufMs).toISOString();
  const adjEnd = new Date(endMs + bufMs).toISOString();

  // intersection: booking.start_at < adjEnd  AND  booking.end_at > adjStart
  // Using strict < and > to avoid edge miscounts (change to lte/gte if inclusive edges needed)
  const { data, error } = await supabase
    .from("v_bookings_full")
    .select("*")
    .in("car_id", carIds)
    .lt("start_at", adjEnd)
    .gt("end_at", adjStart);

  if (error) {
    // bubble up error so caller can decide fallback
    throw error;
  }

  return (data ?? []) as BookingFull[];
}
