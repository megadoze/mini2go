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

  // ⬇️ НОВОЕ — владелец авто
  owner?: { id: string; full_name: string | null } | null;
};

// удобный хелпер
type OneOrMany<T> = T | T[] | null;
const first = <T,>(x: OneOrMany<T>): T | null =>
  Array.isArray(x) ? x[0] ?? null : x ?? null;

type RawBookingRow = Omit<BookingRow, "user" | "owner"> & {
  user?: { id: string; full_name: string | null; email?: string | null }[] | null;

  // ⬇️ структура под join машины и её владельца
  car?: OneOrMany<{
    id: string;
    owner_id: string | null;
    owner?: OneOrMany<{
      id: string;
      full_name: string | null;
    }>;
  }>;
};

async function fetchBookingsByCarIds(carIds: string[]) {
  if (carIds.length === 0) return [] as BookingRow[];

  const { data, error } = await supabase
    .from("bookings")
    .select(
      `
      id, user_id, start_at, end_at, status, car_id, price_total, currency, created_at,
      user:profiles ( id, full_name, email ),
      car:cars!inner(
        id,
        owner_id,
        owner:profiles!cars_owner_fkey ( id, full_name )
      )
    `
    )
    .in("car_id", carIds)
    .neq("mark", "block")
    .neq("status", "blocked")
    .order("start_at", { ascending: false });

  if (error) throw error;

  const rows = (data ?? []) as unknown as RawBookingRow[];

  return rows.map(({ user, car, ...rest }) => {
    const u = Array.isArray(user) ? user[0] ?? null : (user as any) ?? null;
    const c = first(car);
    const o = c ? first(c.owner) : null;

    return {
      ...rest,
      user: u ? { id: u.id, full_name: u.full_name, email: (u as any).email ?? null } : null,
      owner: o ? { id: o.id, full_name: o.full_name } : null, // ⬅️ вот он владелец
    } as BookingRow;
  });
}

export const bookingsLoader: LoaderFunction = async ({ request }) => {
  const url = new URL(request.url);

  // 1) берем owner из query или текущего пользователя
  const { data: { session } } = await supabase.auth.getSession();
  const meId = session?.user?.id ?? null;
  const ownerId = url.searchParams.get("owner") ?? meId;

  if (!ownerId) return { ownerId: null };

  // 2) ensure список машин хозяина
  const cars = await queryClient.ensureQueryData({
    queryKey: ["carsByHost", ownerId],
    queryFn: () => fetchCarsByHost(ownerId),
    staleTime: 5 * 60_000,
  });

  // 3) ensure брони по этим машинам (теперь каждая запись содержит owner)
  await queryClient.ensureQueryData({
    queryKey: ["bookingsIndex", ownerId],
    queryFn: () => fetchBookingsByCarIds((cars as any[]).map((c) => c.id)),
    staleTime: 60 * 1000,
  });

  return { ownerId };
};
