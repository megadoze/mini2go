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

  // 1) машины хоста (легкий селект)
  const { data: cars, error: carsErr } = await supabase
    .from("cars")
    .select(
      `
      id,
      license_plate,
      models(name, brands(name))
    `
    )
    .eq("owner_id", ownerId);

  if (carsErr) throw carsErr;

  const lite: CarLite[] =
    (cars ?? []).map((c: any) => {
      const model = Array.isArray(c.models) ? c.models[0] : c.models;
      const brand = Array.isArray(model?.brands) ? model.brands[0] : model?.brands;
      return {
        id: c.id,
        brand: brand?.name ?? null,
        model: model?.name ?? null,
        license_plate: c.license_plate ?? null,
      };
    }) ?? [];

  if (lite.length === 0) {
    return { monthISO: monthStart.toISOString(), rangeStart: from, rangeEnd: to, cars: [] };
  }

  // 2) брони для этих машин, которые ПЕРЕСЕКАЮТ окно [from, to]
  // условие пересечения: start_at <= to AND end_at >= from
  const ids = lite.map((c) => c.id);
  const { data: bookings, error: bErr } = await supabase
    .from("bookings")
    .select(
      `
      id, car_id, user_id, start_at, end_at, status, mark, price_total, currency, created_at
    `
    )
    .in("car_id", ids)
    .lte("start_at", to)
    .gte("end_at", from);

  if (bErr) throw bErr;

  const byCar = new Map<string, Booking[]>();
  for (const c of lite) byCar.set(c.id, []);
  for (const b of bookings ?? []) {
    const arr = byCar.get(b.car_id) ?? [];
    arr.push(b as Booking);
    byCar.set(b.car_id, arr);
  }

  const result: CarWithBookings[] = lite.map((c) => ({
    ...c,
    bookings: byCar.get(c.id) ?? [],
  }));

  return {
    monthISO: monthStart.toISOString(),
    rangeStart: from,
    rangeEnd: to,
    cars: result,
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
