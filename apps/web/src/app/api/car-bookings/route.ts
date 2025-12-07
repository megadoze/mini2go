import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const carId = searchParams.get("carId");

    if (!carId) {
      return NextResponse.json({ error: "carId is required" }, { status: 400 });
    }

    // получаем ВСЕ брони по машине
    const { data, error } = await supabaseServer
      .from("bookings")
      .select("id, start_at, end_at, status")
      .eq("car_id", carId)
      .order("start_at", { ascending: true });

    if (error) {
      console.error("car-bookings error:", error);
      return NextResponse.json(
        { error: "failed to load bookings" },
        { status: 500 }
      );
    }

    return NextResponse.json(data || []);
  } catch (err) {
    console.error("car-bookings exception:", err);
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }
}
