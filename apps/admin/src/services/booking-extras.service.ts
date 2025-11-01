// services/booking-extras.service.ts
import { supabase } from "@/lib/supabase";

export type BookingExtraRow = {
  id: string;
  booking_id: string;
  extra_id: string;
  title?: string | null;
  qty: number;
  price: number;
  total: number;
};

export async function upsertBookingExtras(
  bookingId: string,
  items: Omit<BookingExtraRow, "id" | "booking_id" | "total">[]
) {
  const rows = items.map((i) => ({
    booking_id: bookingId,
    extra_id: i.extra_id,
    title: i.title ?? null,
    qty: i.qty,
    price: i.price,
    total: Math.round(i.price * i.qty * 100) / 100,
  }));

  // проще: удалить и вставить заново (в рамках одной транзакции — если используешь RPC)
  await supabase.from("booking_extras").delete().eq("booking_id", bookingId);
  const { error } = await supabase.from("booking_extras").insert(rows);
  if (error) throw error;
  return rows;
}

export async function fetchBookingExtras(bookingId: string) {
  const { data, error } = await supabase
    .from("booking_extras")
    .select("extra_id,title,price,price_type,qty")
    .eq("booking_id", bookingId);
  if (error) throw error;
  return data ?? [];
  return [] as any[]; // временный заглушечный возврат, чтобы сборка не падала
}
