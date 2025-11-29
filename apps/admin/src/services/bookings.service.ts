import { supabase } from "@/lib/supabase";
import type { PostgrestSingleResponse } from "@supabase/supabase-js";
import type { Booking as DbBooking } from "@/types/booking";
import type {
  BookingCard,
  BookingCard as BookingCardType,
} from "@/types/bookingCard";
import { eachDayOfInterval, parseISO } from "date-fns";

type OneOrMany<T> = T | T[] | null;
const first = <T>(x: OneOrMany<T>): T | null =>
  Array.isArray(x) ? x[0] ?? null : x ?? null;

export type BookingJoinedRow = {
  user: OneOrMany<{
    id: string;
    full_name: string | null;
    email: string | null;
  }>;
  id: string;
  start_at: string;
  end_at: string;
  status: string | null;
  mark: "booking" | "block";
  car_id: string;
  user_id: string | null;
  created_at: string | null;
  price_total: number | null;
  owner_full_name: string | null;
  car: OneOrMany<{
    id: string;
    year: number | null;
    cover_photos: string[] | null;
    license_plate: string | null;
    deposit: number | null;
    model_id: string | null;
    model: OneOrMany<{
      id: string;
      name: string | null;
      brand_id: string | null;
      brand: OneOrMany<{ id: string; name: string | null }>;
    }>;
    location: OneOrMany<{
      id: string;
      name: string | null;
      country_id: string | null;
    }>;
  }>;
};

export type BookingStatusDB =
  | "confirmed"
  | "rent"
  | "onapproval"
  | "finished"
  | "canceledhost"
  | "canceledguest"
  | "canceledtime";

// Единый SELECT для карточки
export const SELECT_BOOKING_CARD = `
  id, start_at, end_at, status, mark, car_id, user_id, created_at, price_total,
  user:profiles!left(id, full_name, email),
  car:cars!inner(
    id, year, cover_photos, license_plate, model_id, deposit, owner_id,
    model:models(
      id, name, brand_id,
      brand:brands( id, name )
    ),
    location:locations!inner( id, name, country_id )
  )
` as const;

export function mapRowToBookingCard(row: BookingJoinedRow): BookingCardType {
  const car = first(row.car);
  const model = first(car?.model);
  const brand = first(model?.brand);
  const loc = first(car?.location);

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
          photo: Array.isArray(car.cover_photos) ? car.cover_photos[0] ?? null : null,
          locationName: loc?.name ?? null,
          countryId: loc?.country_id ?? null,
        }
      : null,
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

export function subscribeBooking<T = any>(
  id: string,
  onChange: (row: T) => void
): () => void {
  const ch = supabase
    .channel(`booking-${id}`)
    .on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "bookings", filter: `id=eq.${id}` },
      (payload) => onChange(payload.new as T)
    )
    .subscribe();

  return () => { try { supabase.removeChannel(ch); } catch {} };
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

// service
export type FetchBookingsIndexParams = {
  ownerId: string;
  limit: number;
  offset: number;
  status?: string;
  userId?: string;
  countryId?: string;
  location?: string;
  q?: string;
};

export type BookingsIndexRow = {
  car_model: string;
  car_brand: string;
  id: string;
  start_at: string;
  end_at: string;
  status: string | null;
  mark: "booking" | "block";
  car_id: string;
  user_id: string | null;
  created_at: string | null;
  price_total: number | null;
  owner_id: string;
  owner_full_name: string | null;
  cover_photos: string[] | null;
  license_plate: string | null;
  year: number | null;
  deposit: number | null;

  brand_name: string | null;
  model_name: string | null;

  location_name: string | null;
  country_id: string | null;

  user_full_name: string | null;
  user_email: string | null;
  user_phone: string | null;
};

export async function fetchBookingsIndexPage(params: {
  ownerId: string | null;
  limit: number;
  offset: number;
  status?: string;
  userId?: string;
  countryId?: string;
  location?: string;
  q?: string;
}): Promise<{ items: BookingsIndexRow[]; count: number }> {
  const { ownerId, limit, offset, status, userId, countryId, location, q } =
    params;

  let qy = supabase
    .from("bookings_index")
    .select("*", { count: "exact" })
    .eq("owner_id", ownerId)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (status) qy = qy.eq("status", status.toLowerCase());
  if (userId) qy = qy.eq("user_id", userId);
  if (countryId) qy = qy.eq("country_id", countryId);
  if (location) qy = qy.ilike("location_name", `%${location}%`);
  if (q) {
    const s = q.replace(/[%_]/g, (m) => `\\${m}`);
    qy = qy.or(
      [
        `license_plate.ilike.%${s}%`,
        `brand_name.ilike.%${s}%`,
        `model_name.ilike.%${s}%`,
        `user_full_name.ilike.%${s}%`,
        `owner_full_name.ilike.%${s}%`,
      ].join(",")
    );
  }

  const { data, error, count } = await qy;
  if (error) throw error;
  return { items: (data ?? []) as BookingsIndexRow[], count: count ?? 0 };
}


export async function fetchBookingsByUser(params: {
  limit: number;
  offset: number;
  userId: string;
  status?: string;
  countryId?: string;
  location?: string;
  q?: string;
}): Promise<{ items: BookingsIndexRow[]; count: number }> {
  const { limit, offset, userId, status, countryId, location, q } = params;

  // страховка на уровне кода
  if (!userId) {
    throw new Error("fetchBookingsByUser: userId is required");
  }

  let qy = supabase
    .from("bookings_index")
    .select("*", { count: "exact" })
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (status) qy = qy.eq("status", status.toLowerCase());
  if (countryId) qy = qy.eq("country_id", countryId);
  if (location) qy = qy.ilike("location_name", `%${location}%`);
  if (q) {
    const s = q.replace(/[%_]/g, (m) => `\\${m}`);
    qy = qy.or(
      [
        `license_plate.ilike.%${s}%`,
        `brand_name.ilike.%${s}%`,
        `model_name.ilike.%${s}%`,
        `user_full_name.ilike.%${s}%`,
        `owner_full_name.ilike.%${s}%`,
      ].join(",")
    );
  }

  const { data, error, count } = await qy;
  if (error) throw error;
  return { items: (data ?? []) as BookingsIndexRow[], count: count ?? 0 };
}

// mapper
export function mapIndexRowToBookingCard(r: BookingsIndexRow): BookingCard {
  return {
    id: r.id,
    startAt: r.start_at,
    endAt: r.end_at,
    status: r.status,
    mark: r.mark,
    carId: r.car_id,
    userId: r.user_id,
    createdAt: r.created_at,
    priceTotal: r.price_total ?? null,
    userEmail: r.user_email ?? null,
    userPhone: r.user_phone ?? null,
    ownerName: r.owner_full_name ?? null,
    car: {
      id: r.car_id,
      brand: r.brand_name ?? null, // ← БРЕНД
      model: r.model_name ?? null, // ← МОДЕЛЬ
      year: r.year ?? null,
      licensePlate: r.license_plate ?? null, // ← ГОСНОМЕР
      deposit: r.deposit ?? null,
      photo: Array.isArray(r.cover_photos) ? r.cover_photos[0] ?? null : null,
      locationName: r.location_name ?? null,
      countryId: r.country_id ?? null,
    },
  } as BookingCard;
}
