import { supabase } from "@/lib/supabase";
import type { PostgrestSingleResponse } from "@supabase/supabase-js";
import type { Booking as DbBooking } from "@/types/booking";
import type { BookingCard as BookingCardType } from "@/types/bookingCard";
import { eachDayOfInterval, parseISO } from "date-fns";

// Тип под конкретный select-ответ
export type BookingJoinedRow = {
  id: string;
  start_at: string;
  end_at: string;
  status: string | null;
  mark: "booking" | "block";
  car_id: string;
  user_id: string | null;
  created_at: string | null;
  price_total: number | null;
  car: {
    id: string;
    year: number | null;
    photos: string[] | null;
    license_plate: string | null;
    deposit: number | null;
    model_id: string | null;
    model: {
      id: string;
      name: string | null;
      brand_id: string | null;
      brand: { id: string; name: string | null } | null;
    } | null;
  } | null;
};

// Единый SELECT для карточки
export const SELECT_BOOKING_CARD = `
  id, start_at, end_at, status, mark, car_id, user_id, created_at, price_total,
  car:cars (
    id, year, photos, license_plate, model_id, deposit,
    model:models (
      id, name, brand_id,
      brand:brands ( id, name )
    )
  )
` as const;

// Нормализация: если вдруг вложенная связь вернулась массивом — берём первый элемент
const first = <T>(x: T | T[] | null | undefined): T | null =>
  Array.isArray(x) ? x[0] ?? null : x ?? null;

export function mapRowToBookingCard(row: BookingJoinedRow): BookingCardType {
  const car = first(row.car);
  const model = first(car?.model);
  const brand = first(model?.brand);
  return {
    id: row.id,
    startAt: row.start_at,
    endAt: row.end_at,
    status: row.status,
    mark: row.mark,
    carId: row.car_id,
    userId: row.user_id,
    createdAt: row.created_at,
    car: car
      ? {
          id: car.id,
          brand: brand?.name ?? null,
          model: model?.name ?? null,
          year: car.year ?? null,
          licensePlate: car.license_plate ?? null,
          deposit: car.deposit ?? null,
          photo: Array.isArray(car.photos) ? car.photos[0] ?? null : null,
        }
      : null,
    // если поле есть в твоём типе — оно попадёт; иначе можно обращаться как (booking as any).priceTotal в UI

    priceTotal: row.price_total ?? null,
  } as BookingCardType;
}

export async function fetchBookingCard(
  id: string
): Promise<BookingCardType | null> {
  const { data, error }: PostgrestSingleResponse<BookingJoinedRow> =
    await supabase
      .from("bookings")
      .select(SELECT_BOOKING_CARD)
      .eq("id", id)
      .single();
  if (error) throw error;
  if (!data) return null;
  return mapRowToBookingCard(data);
}

export async function updateBookingCard(
  id: string,
  payload: Partial<DbBooking>
): Promise<BookingCardType> {
  const dbPayload: Partial<DbBooking> = {
    status: payload.status,
    start_at: payload.start_at,
    end_at: payload.end_at,
    price_total: payload.price_total,
  };
  const { data, error }: PostgrestSingleResponse<BookingJoinedRow> =
    await supabase
      .from("bookings")
      .update(dbPayload)
      .eq("id", id)
      .select(SELECT_BOOKING_CARD)
      .single();
  if (error) throw error;
  return mapRowToBookingCard(data!);
}

export function subscribeBooking(id: string, onChange: () => void): () => void {
  const ch = supabase
    .channel(`booking-${id}`)
    .on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "bookings",
        filter: `id=eq.${id}`,
      },
      onChange
    )
    .subscribe();
  return () => {
    try {
      supabase.removeChannel(ch);
    } catch {
      /* noop */
    }
  };
}

export async function cancelAndUnlock(
  bookingId: string
): Promise<BookingCardType> {
  // 1) Сначала обновим статус брони и получим обновлённую карточку
  const updated = await updateBookingCard(bookingId, {
    status: "canceledHost",
  });

  // 2) Пытаемся разблокировать даты, если в cars есть поле unavailable_days (jsonb/number[])
  try {
    // Зачитываем минимум данных по брони (для диапазона и car_id)
    const {
      data: b,
      error: bErr,
    }: PostgrestSingleResponse<
      Pick<DbBooking, "id" | "start_at" | "end_at" | "car_id">
    > = await supabase
      .from("bookings")
      .select("id, start_at, end_at, car_id")
      .eq("id", bookingId)
      .single();

    if (bErr || !b?.car_id || !b.start_at || !b.end_at) return updated;

    // ⚠️ если у тебя «недни», а слоты по часам, подкорректируй вычисление списка
    const start = parseISO(b.start_at);
    const end = parseISO(b.end_at);
    const days = eachDayOfInterval({ start, end }).map((d) => d.getTime());
    const daysSet = new Set<number>(days);

    // Пробуем прочитать колонку (если её нет — ловим ошибку 42703 и выходим)
    const { data: carRow, error: carErr } = await supabase
      .from("cars")
      .select("id, unavailable_days")
      .eq("id", b.car_id)
      .maybeSingle();

    // Если колонки нет или не массив — выходим молча
    if (carErr?.code === "42703") return updated; // column does not exist
    const current: unknown = (carRow as any)?.unavailable_days;
    if (!Array.isArray(current)) return updated;

    const next = (current as number[]).filter((ts) => !daysSet.has(ts));

    // Пишем обратно только если что-то поменялось
    if (JSON.stringify(next) !== JSON.stringify(current)) {
      const { error: upErr } = await supabase
        .from("cars")
        .update({ unavailable_days: next })
        .eq("id", b.car_id);
      if (upErr) console.warn("[cars/update unavailable_days] skip", upErr);
    }
  } catch (e) {
    // ничего критичного — разблокировка носит вспомогательный характер
    console.warn("[cancelAndUnlock] unlock skipped:", e);
  }

  return updated;
}
