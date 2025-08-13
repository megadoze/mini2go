import { supabase } from "@/lib/supabase";
import type { PostgrestSingleResponse } from "@supabase/supabase-js";
import type { Booking as DbBooking } from "@/types/booking";
import type { BookingCard as BookingCardType } from "@/types/bookingCard";

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
