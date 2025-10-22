import { supabase } from "@/lib/supabase";
import type { Booking } from "@/types/booking";
import type { Car } from "@/types/car";
import type { Profile } from "@/types/profile";

export type BookingFull = Booking & {
  user?: Profile | null;
  host?: Profile | null;
  car?: Car | null;
};

export async function fetchBookingsByCarId(carId: string): Promise<BookingFull[]> {
  const { data, error } = await supabase
    .from("v_bookings_full")
    .select("*")
    .eq("car_id", carId);

  if (error) throw error;
  return (data ?? []) as BookingFull[];
}


export async function fetchBookingById(id: string): Promise<BookingFull> {
  const { data, error } = await supabase
  .from('v_bookings_full')
  .select('*')
  .eq('id', id)
  .single();

  if (error) throw error;
  return data as BookingFull;
}




export async function createBooking(
  booking: Omit<Booking, "id">
): Promise<BookingFull> {
  const { data, error } = await supabase
    .from("bookings")
    .insert(booking)
    .select("id") // важно: только id
    .single();
  if (error) throw error;

  // единая точка истины
  return await fetchBookingById(data.id);
}

export async function deleteBooking(id: string): Promise<void> {
  const { error } = await supabase.from("bookings").delete().eq("id", id);

  if (error) throw error;
}

// calendar.service.ts

export async function updateBooking(
  id: string,
  patch: Partial<Booking>
): Promise<BookingFull> {
  const { error } = await supabase
    .from("bookings")
    .update(patch)
    .eq("id", id);
  if (error) throw error;

  // единая точка истины
  return await fetchBookingById(id);
}
