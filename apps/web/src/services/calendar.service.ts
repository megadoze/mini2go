// src/services/calendar.service.ts
"use client";

import { getSupabaseClient } from "@/lib/supabase";
import type { Booking } from "@/types/booking";
import type { Car } from "@/types/car";
import type { Profile } from "@/types/profile";

export type BookingFull = Booking & {
  user?: Profile | null;
  host?: Profile | null;
  car?: Car | null;
};

function requireSupabase() {
  const supabase = getSupabaseClient();
  if (!supabase) {
    throw new Error(
      "[calendar.service] Supabase client is not available (no NEXT_PUBLIC_SUPABASE_URL / KEY or code ran on server)"
    );
  }
  return supabase;
}

// READ: можно сделать мягким, чтобы билд не падал
export async function fetchBookingsByCarId(
  carId: string
): Promise<BookingFull[]> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    // на билде / без env — просто пусто
    return [];
  }

  const { data, error } = await supabase
    .from("v_bookings_full")
    .select("*")
    .eq("car_id", carId);

  if (error) throw error;
  return (data ?? []) as BookingFull[];
}

export async function fetchBookingById(id: string): Promise<BookingFull> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    throw new Error("[calendar.service] Cannot fetch booking on server");
  }

  const { data, error } = await supabase
    .from("v_bookings_full")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;
  if (!data) {
    const err = new Error("Booking not found");
    (err as any).code = "NOT_FOUND";
    throw err;
  }

  return data as BookingFull;
}

// WRITE: тут лучше жёстко требовать клиент
export async function createBooking(
  booking: Omit<Booking, "id">
): Promise<BookingFull> {
  const supabase = requireSupabase();

  const { data, error } = await supabase
    .from("bookings")
    .insert(booking)
    .select("id")
    .single();

  if (error) throw error;

  return await fetchBookingById(data.id);
}

export async function deleteBooking(id: string): Promise<void> {
  const supabase = requireSupabase();
  const { error } = await supabase.from("bookings").delete().eq("id", id);

  if (error) throw error;
}

export async function updateBooking(
  id: string,
  patch: Partial<Booking>
): Promise<BookingFull> {
  const supabase = requireSupabase();

  const { error } = await supabase.from("bookings").update(patch).eq("id", id);
  if (error) throw error;

  return await fetchBookingById(id);
}
