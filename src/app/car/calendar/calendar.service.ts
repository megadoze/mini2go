import { supabase } from "@/lib/supabase";
import type { Booking } from "@/types/booking";

export async function fetchBookingsByCarId(carId: string): Promise<Booking[]> {
  const { data, error } = await supabase
    .from("bookings")
    .select("*")
    .eq("car_id", carId);

  if (error) throw error;
  return data ?? [];
}

export async function fetchBookingById(id: string): Promise<Booking> {
  const { data, error } = await supabase
    .from("bookings")
    .select("*")
    .eq("id", id)
    .single();
  if (error) throw error;
  return data!;
}

export async function createBooking(
  booking: Omit<Booking, "id">
): Promise<Booking> {
  const { data, error } = await supabase
    .from("bookings")
    .insert(booking)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteBooking(id: string): Promise<void> {
  const { error } = await supabase.from("bookings").delete().eq("id", id);

  if (error) throw error;
}

// calendar.service.ts

export async function updateBooking(
  id: string,
  patch: Partial<Booking>
): Promise<Booking> {
  const { data, error } = await supabase
    .from("bookings")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();

  if (error) throw error;
  return data as Booking;
}
