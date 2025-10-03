// routes/userBookings.loader.ts
import type { LoaderFunction } from "react-router";
import type { InfiniteData } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { supabase } from "@/lib/supabase";
import { fetchBookingsByUser, type BookingsIndexRow } from "@/services/bookings.service";
import { QK } from "@/queryKeys";

type Page = { items: BookingsIndexRow[]; count: number };
const PAGE_SIZE = 10;

export const userBookingsLoader: LoaderFunction = async ({ request }) => {
  const url = new URL(request.url);

  // текущий пользователь (не трогаем user_id)
  const { data: { session } } = await supabase.auth.getSession();
  const meId = session?.user?.id ?? null;

  // хотим показывать брони именно текущего юзера:
  const userId = (url.searchParams.get("user") ?? meId) ?? null;
  if (!userId) return { userId: null };

  // важно: фильтр-ключ должен БУКВАЛЬНО совпадать с тем, что собирает компонент
  const filterKey = {
    status: null,
    countryId: null,
    q: null,
    location: null,
    userId,            // строка UUID
  } as const;

  const key = [...QK.bookingsUserInfinite(userId, PAGE_SIZE), filterKey] as const;

  // 1) пробуем взять из кэша — если есть, НИЧЕГО не грузим
  const cached = queryClient.getQueryData<InfiniteData<Page, number>>(key);

  if (!cached) {
    // 2) кэша нет — грузим первую страницу и кладём в InfiniteData
    const firstPage = await fetchBookingsByUser({
      limit: PAGE_SIZE,
      offset: 0,
      userId, // ← строго строка, без undefined
    });

    const infiniteShape: InfiniteData<Page, number> = {
      pages: [firstPage],
      pageParams: [0],
    };

    queryClient.setQueryData(key, infiniteShape);
  }

  // отдаём userId компоненту
  return { userId };
};


// import type { LoaderFunction } from "react-router";
// import { queryClient } from "@/lib/queryClient";
// import { supabase } from "@/lib/supabase";
// import { fetchCarsByHost } from "@/services/car.service";

// type BookingRow = {
//   id: string;
//   start_at: string;
//   end_at: string;
//   status: string | null;
//   car_id: string;
//   user_id: string | null;
//   price_total: number | null;
//   currency: string | null;
//   created_at: string;
//   user?: { id: string; full_name: string | null; email?: string | null } | null;
// };

// type RawBookingRow = Omit<BookingRow, "user"> & {
//   user?: { id: string; full_name: string | null; email?: string | null }[] | null;
// };

// async function fetchBookingsByCarIds(carIds: string[]) {
//   if (carIds.length === 0) return [] as BookingRow[];

//   const { data, error } = await supabase
//     .from("bookings")
//     .select(`
//       id, user_id, start_at, end_at, status, car_id, price_total, currency, created_at,
//       user:profiles ( id, full_name, email )
//     `)
//     .in("car_id", carIds)
//     .neq("mark", "block")
//     .neq("status", "blocked")
//     .order("start_at", { ascending: false });

//   if (error) throw error;

//   const rows = (data ?? []) as unknown as RawBookingRow[];
//   return rows.map(({ user, ...rest }) => ({
//     ...rest,
//     user: Array.isArray(user) ? user[0] ?? null : user ?? null,
//   }));
// }

// export const userBookingsLoader: LoaderFunction = async ({ request }) => {
//   const url = new URL(request.url);

//   const { data: { session } } = await supabase.auth.getSession();
//   const meId = session?.user?.id ?? null;
//   const userId = url.searchParams.get("user") ?? meId;

//   if (!userId) return { userId: null };

//   // ✅ ключ совпадает с параметром
//   const cars = await queryClient.ensureQueryData({
//     queryKey: ["carsByHost", userId],
//     queryFn: () => fetchCarsByHost(userId),
//     staleTime: 5 * 60_000,
//   });

//   await queryClient.ensureQueryData({
//     queryKey: ["bookingsIndex", userId],
//     queryFn: () => fetchBookingsByCarIds((cars as any[]).map((c) => c.id)),
//     staleTime: 60 * 1000,
//   });

//   return { userId };
// };



// import type { LoaderFunction } from "react-router";
// import { queryClient } from "@/lib/queryClient";
// import { supabase } from "@/lib/supabase";
// import {
//   fetchBookingsByUser,
//   type BookingsIndexRow,
// } from "@/services/bookings.service";
// import type { InfiniteData } from "@tanstack/react-query";
// import { QK } from "@/queryKeys";

// type Page = { items: BookingsIndexRow[]; count: number };
// const PAGE_SIZE = 10;

// export const userBookingsLoader: LoaderFunction = async ({ request, params }) => {
//   const url = new URL(request.url);

//   const {
//     data: { session },
//   } = await supabase.auth.getSession();
//   const meId = session?.user?.id ?? null;

//   // приоритет: UUID из :id, иначе ?user, иначе текущий пользователь
//   const raw = params.id ?? url.searchParams.get("user") ?? meId;

//   if (!raw) {
//     // гость — компонент сам разрулит пустое состояние
//     return { userId: null };
//   }

//   // хотим показывать брони текущего пользователя:
//   if (!meId) return { userId: null };      // страховка
//   const userId: string = meId;              // ← теперь точно string

//   // ключ фильтра ДОЛЖЕН совпадать с компонентом
//   const filterKey = {
//     status: null as null,
//     countryId: null as null,
//     q: null as null,
//     location: null as null,
//     userId,                                  // ← string
//   } as const;

//   const firstPage = await fetchBookingsByUser({
//     limit: PAGE_SIZE,
//     offset: 0,
//     userId,                                  // ← string, не union
//   });
  

//   const key = [...QK.bookingsUserInfinite(userId, PAGE_SIZE), filterKey] as const;

//   await queryClient.ensureQueryData({
//   queryKey: key,
//   queryFn: async () => {
//     const firstPage = await fetchBookingsByUser({ limit: PAGE_SIZE, offset: 0, userId });
//     return { pages: [firstPage], pageParams: [0] } as InfiniteData<Page, number>;
//   },
//   staleTime: 5 * 60 * 1000,  // пока свежо — повторно не фетчит
// });

//   const infiniteShape: InfiniteData<Page, number> = {
//     pages: [firstPage],
//     pageParams: [0],
//   };

//   queryClient.setQueryData(key, infiniteShape);

//   return { userId };
// };
