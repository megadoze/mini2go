// app/api/availability/route.ts
import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

// какие статусы брони реально блокируют даты
const BLOCKING_BOOKING_STATUSES = new Set([
  "onapproval",
  "confirmed",
  "rent",
]);

function isBlockingBooking(b: any) {
  if (b.mark === "block") return true;
  if (b.mark === "booking") {
    const st = String(b.status || "").toLowerCase();
    return BLOCKING_BOOKING_STATUSES.has(st);
  }
  return false;
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const carIdsRaw = url.searchParams.get("carIds") || "";
    const start = url.searchParams.get("start");
    const end = url.searchParams.get("end");
    const bufferMinutes = Number(url.searchParams.get("buffer") || 0);

    const carIds = carIdsRaw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    if (!carIds.length || !start || !end) {
      return NextResponse.json(
        { error: "carIds, start, end are required" },
        { status: 400 }
      );
    }

    const startMs = new Date(start).getTime();
    const endMs = new Date(end).getTime();
    if (Number.isNaN(startMs) || Number.isNaN(endMs) || endMs <= startMs) {
      return NextResponse.json(
        { error: "Invalid date interval" },
        { status: 400 }
      );
    }

    const bufMs = Math.max(0, bufferMinutes || 0) * 60 * 1000;
    const adjStart = new Date(startMs - bufMs).toISOString();
    const adjEnd = new Date(endMs + bufMs).toISOString();

    // ⚠️ ВАЖНО: supabaseServer тут с SERVICE_ROLE, RLS не мешает
    const { data, error } = await supabaseServer
      .from("bookings")
      .select("id, car_id, start_at, end_at, status, mark")
      .in("car_id", carIds)
      .lt("start_at", adjEnd)
      .gt("end_at", adjStart);

    if (error) {
      console.error("availability select error", error);
      return NextResponse.json(
        { error: "Failed to load availability" },
        { status: 500 }
      );
    }

    const list = (data ?? []).filter(isBlockingBooking);

    return NextResponse.json(list, { status: 200 });
  } catch (err) {
    console.error("availability API unhandled error", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
