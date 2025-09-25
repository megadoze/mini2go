// routes/bookings.loader.ts
import type { LoaderFunction } from "react-router";
import { queryClient } from "@/lib/queryClient";
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
  return rows.map(({ user, ...rest }) => ({
    ...rest,
    user: Array.isArray(user) ? user[0] ?? null : user ?? null,
  }));
}

export const bookingsLoader: LoaderFunction = async ({ request }) => {
  const url = new URL(request.url);

  // 1) берем owner из query или текущего пользователя
  const { data: { session } } = await supabase.auth.getSession();
  const meId = session?.user?.id ?? null;
  const ownerId = url.searchParams.get("owner") ?? meId;

  // Если id неизвестен (гость) — не префетчим; компонент сам разрулит
  if (!ownerId) {
    return { ownerId: null };
  }

  // 2) ensure список машин хозяина
  const cars = await queryClient.ensureQueryData({
    queryKey: ["carsByHost", ownerId],
    queryFn: () => fetchCarsByHost(ownerId),
    staleTime: 5 * 60_000,
  });

  // 3) ensure брони по этим машинам
  await queryClient.ensureQueryData({
    queryKey: ["bookingsIndex", ownerId],
    queryFn: () => fetchBookingsByCarIds((cars as any[]).map((c) => c.id)),
    staleTime: 60 * 1000,
  });

  return { ownerId };
};
