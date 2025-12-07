// src/services/catalog-availability.service.ts
"use client";

import type { BookingFull } from "./calendar.service";

export async function fetchBookingsForCarsInRange(params: {
  carIds: string[];
  start: string; // ISO
  end: string; // ISO
  bufferMinutes?: number;
}): Promise<BookingFull[]> {
  const { carIds, start, end, bufferMinutes = 0 } = params;
  if (!carIds || !carIds.length) return [];

  const qs = new URLSearchParams({
    carIds: carIds.join(","),
    start,
    end,
    buffer: String(bufferMinutes),
  });

  const res = await fetch(`/api/availability?${qs.toString()}`, {
    method: "GET",
  });

  if (!res.ok) {
    if (process.env.NODE_ENV !== "production") {
      console.error(
        "[catalog-availability] /api/availability error",
        res.status,
        await res.text()
      );
    }
    return [];
  }

  const data = (await res.json()) ?? [];
  return data as BookingFull[];
}
