// routes/usersLoader.ts
import type { LoaderFunction } from "react-router";
import { queryClient } from "@/lib/queryClient";
import { supabase } from "@/lib/supabase";
import type { InfiniteData } from "@tanstack/react-query";
import { QK } from "@/queryKeys";
import { fetchUsersPage, type UserListRow } from "@/services/user.service";

type Page = { items: UserListRow[]; count: number };

const PAGE_SIZE = 10;

export const usersAdminLoader: LoaderFunction = async ({ request }) => {
  const url = new URL(request.url);

  const q = url.searchParams.get("q") || undefined;
  const status = url.searchParams.get("status") || undefined;
  const sortParam = url.searchParams.get("sort") as
    | "full_name"
    | "email"
    | "created_at"
    | null;
  const dirParam = url.searchParams.get("dir") as "asc" | "desc" | null;

  const sort = sortParam ?? "full_name";
  const dir = dirParam ?? "asc";

  // текущего юзера можно исключить из списка (админ/хост сам себя не видит)
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const excludeUserId = session?.user?.id ?? null;

  // прогреваем кеш для useInfiniteQuery
  await queryClient.ensureQueryData<InfiniteData<Page, number>>({
    queryKey: QK.usersInfinite(PAGE_SIZE, q, status, sort, dir, excludeUserId),
    queryFn: async () => {
      const firstPage = await fetchUsersPage({
        limit: PAGE_SIZE,
        offset: 0,
        q,
        status,
        sort,
        dir,
        excludeUserId: excludeUserId ?? undefined,
      });

      return {
        pages: [firstPage],
        pageParams: [0], // первый offset = 0
      };
    },
    staleTime: 5 * 60_000,
  });

  return {
    excludeUserId,
    q: q ?? "",
    status: status ?? "",
    sort,
    dir,
  };
};
