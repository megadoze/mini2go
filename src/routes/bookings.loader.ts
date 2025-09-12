// routes/bookings.loader.ts
import type { LoaderFunction } from "react-router";
import { queryClient } from "@/lib/queryClient"; // один и тот же инстанс
import { supabase } from "@/lib/supabase";
import { fetchCarsByHost } from "@/services/car.service";

type BookingRow = {
  id: string;
  start_at: string;
  end_at: string;
  status: string | null;
  car_id: string;
  user_id: string | null;
  price_total: number | null;
  currency: string | null;
  created_at: string;
  user?: { id: string; full_name: string | null; email?: string | null } | null;
};

type RawBookingRow = Omit<BookingRow, "user"> & {
  user?:
    | { id: string; full_name: string | null; email?: string | null }[]
    | null;
};

async function fetchBookingsByCarIds(carIds: string[]) {
  if (carIds.length === 0) return [] as BookingRow[];

  const { data, error } = await supabase
    .from("bookings")
    .select(
      `
      id, user_id, start_at, end_at, status, car_id, price_total, currency, created_at,
      user:profiles ( id, full_name, email )
    `
    )
    .in("car_id", carIds)
    .neq("mark", "block")
    .neq("status", "blocked")
    .order("start_at", { ascending: false });

  if (error) throw error;

  const rows = (data ?? []) as unknown as RawBookingRow[];

  const normalized: BookingRow[] = rows.map(({ user, ...rest }) => ({
    ...rest,
    user: Array.isArray(user) ? user[0] ?? null : user ?? null,
  }));

  return normalized;
}

export const bookingsLoader: LoaderFunction = async ({ request }) => {
  const url = new URL(request.url);

  const ownerId =
    url.searchParams.get("owner") || "a96e557e-5298-4018-bcd9-1f4e5423c2a0";

  // 1) ensure машин — сразу кладём в кэш с ключом ["carsByHost", ownerId]
  const cars = await queryClient.ensureQueryData({
    queryKey: ["carsByHost", ownerId],
    queryFn: () => fetchCarsByHost(ownerId),
  });

  // 2) ensure броней — ключ ["bookingsIndex", ownerId]
  await queryClient.ensureQueryData({
    queryKey: ["bookingsIndex", ownerId],
    queryFn: () => fetchBookingsByCarIds(cars.map((c: any) => c.id)),
  });

  return { ownerId }; // сами данные не таскаем через loader
};
